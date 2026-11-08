import { findTransactionsByUser } from "../models/Transactions.js";
import { findUserNameById } from "../models/User.js";
import { embedText } from "../utils/embedService.js";
import { retrieveRelevantTransactions } from "../utils/retrieveContext.js";
import { buildFinancialSummary } from "../utils/financialSummary.js";
import { buildMessages, streamCompletion } from "../utils/aiService.js";
import { TOOL_DEFINITIONS, TOOL_STATUS, executeTool, getDataOverview } from "../utils/financeTools.js";

const MAX_TOOL_ROUNDS = 3;

/**
 * One chat turn, independent of HTTP, so both the SSE controller and the
 * eval script (scripts/evalChat.js) can drive it.
 *
 * mode "tools" (default): the model calls read-only tools for real numbers,
 *   up to MAX_TOOL_ROUNDS rounds, then answers. Every round is streamed, so
 *   the final answer's tokens reach the user as they are generated.
 * mode "rag": the original pipeline (summary of latest 100 + top-8 semantic
 *   matches in the prompt). Kept as the baseline for the evaluation.
 *
 * @param {object}   p
 * @param {string}   p.userId   - authenticated user id (never from the client body)
 * @param {string}   p.message
 * @param {Array}    p.history  - recent {role, content} turns, oldest first
 * @param {"tools"|"rag"} [p.mode]
 * @param {(token: string) => void}  [p.onToken]
 * @param {(status: string) => void} [p.onStatus] - progress label while tools run
 * @returns {Promise<{reply: string, toolCalls: Array<{name, args, result}>}>}
 */
export const runChat = async ({ userId, message, history = [], mode = "tools", onToken = () => {}, onStatus = () => {} }) => {
  const userName = (await findUserNameById(userId).catch(() => null)) || "the user";
  return mode === "rag"
    ? runRag({ userId, userName, message, history, onToken })
    : runTools({ userId, userName, message, history, onToken, onStatus });
};

const runRag = async ({ userId, userName, message, history, onToken }) => {
  const [embedding, recent] = await Promise.all([
    embedText(message),
    findTransactionsByUser(userId, { sort: "desc", limit: 100 }),
  ]);
  const relevantTransactions = await retrieveRelevantTransactions(userId, embedding);

  const messages = buildMessages({
    mode: "rag",
    question: message,
    history,
    userName,
    summary: buildFinancialSummary(recent),
    relevantTransactions,
  });

  const { content } = await streamCompletion({ messages, onToken });
  return { reply: content, toolCalls: [] };
};

// Groq answers 400 (code "tool_use_failed") when the model writes a malformed tool call.
const isToolCallFailure = (err) => err?.status === 400;

const runTools = async ({ userId, userName, message, history, onToken, onStatus }) => {
  const overview = await getDataOverview(userId);
  const messages = buildMessages({ mode: "tools", question: message, history, userName, overview });
  const toolCalls = [];

  let reply = "";
  const emit = (token) => {
    reply += token;
    onToken(token);
  };

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const lastRound = round === MAX_TOOL_ROUNDS; // out of tool budget: force an answer

    let result;
    try {
      result = await streamCompletion({
        messages,
        onToken: emit,
        tools: TOOL_DEFINITIONS,
        toolChoice: lastRound ? "none" : "auto",
      });
    } catch (err) {
      if (reply || !isToolCallFailure(err)) throw err;
      // Bad tool call from the model: answer with what we have instead of failing the turn.
      console.warn("Tool call rejected by Groq, answering without tools:", err.error ?? err.message);
      await streamCompletion({ messages, onToken: emit, tools: TOOL_DEFINITIONS, toolChoice: "none" });
      break;
    }

    if (result.toolCalls.length === 0) break;

    // Text the model wrote before deciding to call tools: keep it apart from the answer.
    if (result.content.trim()) emit("\n\n");

    messages.push({ role: "assistant", content: result.content || null, tool_calls: result.toolCalls });

    const outputs = await Promise.all(
      result.toolCalls.map(async (call) => {
        const { name, arguments: args } = call.function;
        onStatus(TOOL_STATUS[name] ?? "Looking that up…");
        const output = await executeTool(name, args, userId);
        toolCalls.push({ name, args, result: output });
        console.log(`[chat tool] ${name} ${args} → ${output.error ? `error: ${output.error}` : "ok"}`);
        return { id: call.id, output };
      })
    );

    for (const { id, output } of outputs) {
      messages.push({ role: "tool", tool_call_id: id, content: JSON.stringify(output) });
    }
  }

  return { reply, toolCalls };
};
