import Groq from "groq-sdk";

/**
 * Groq client + prompt builders for the chat (orchestrated by services/chatAgent.js).
 *
 * Two prompt styles:
 *   - "rag":   the original pipeline — financial summary + top-K semantic
 *              matches pasted into the system prompt. Kept for comparison.
 *   - "tools": short prompt; the model fetches real numbers through the
 *              tools in utils/financeTools.js.
 */

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Read lazily so .env changes / eval overrides apply without re-importing.
export const getModel = () => process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

export const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

export const isGreeting = (q) =>
  /^(hi|hello|hey|how are you|good morning|good evening|what's up)\b/i.test(q.trim());

// "2026-11-08 (Sunday)" in India time, so "today/this month" match the tool date ranges.
const todayIST = () => {
  const now = new Date();
  const date = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const weekday = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long" });
  return `${date} (${weekday})`;
};

// ─── RAG prompt (original behaviour, bugs fixed: ₹ lines, real dates, real name) ───

const buildRagContext = (summary, relevantTransactions) => {
  const transactionContext = relevantTransactions.length > 0
    ? relevantTransactions.map((tx, i) =>
        `${i + 1}. ${tx.type === "credit" ? "Credit" : "Debit"} of ${formatCurrency(tx.amount)} at ${tx.merchant} (${tx.category}) on ${tx.timestamp?.slice(0, 10) ?? "N/A"}. Suspicious: ${tx.isSuspicious}`
      ).join("\n")
    : "No relevant transactions found.";

  const categories = Object.entries(summary.categoryMap)
    .map(([cat, amt]) => `  • ${cat}: ${formatCurrency(amt)}`)
    .join("\n");

  return `
  === FINANCIAL PROFILE (latest 100 transactions) ===

  Overview:
    • Total Credits : ${formatCurrency(summary.totalCredit)}
    • Total Debits  : ${formatCurrency(summary.totalDebit)}
    • Net Balance   : ${formatCurrency(summary.balance)}
    • Suspicious Txns: ${summary.suspiciousCount}

  Spending by Category:
  ${categories}

  Merchants Transacted With:
    ${summary.merchants.length > 0 ? summary.merchants.join(", ") : "No merchants found"}

  Recent Relevant Transactions:
  ${transactionContext}
  `.trim();
};

const ragSystemPrompt = ({ userName, summary, relevantTransactions }) => `
You are a helpful and concise financial assistant. Use the provided financial profile and transaction context to answer the user's question. You are currently assisting ${userName}. Today's date is ${todayIST()}.

${buildRagContext(summary, relevantTransactions)}

INSTRUCTIONS:
- Answer ONLY based on the financial data provided above.
- Be concise, specific, and data-driven in your responses.
- If the question is a greeting, respond with a friendly greeting and offer assistance.
- Always use formatted currency values in ₹ (not raw numbers).
- If the question is unclear or cannot be answered with the provided data, ask for clarification and be honest.
- If the data doesn't have enough information to answer, say so honestly.
- Do NOT make up transactions, amounts, or trends not present in the data.
- Keep your response under 150 words unless a detailed breakdown is explicitly asked.
- If the user asks for advice, base it strictly on their actual spending patterns.
`.trim();

// ─── Tools prompt ───────────────────────────────────────────────────────

const toolsSystemPrompt = ({ userName, overview }) => `
You are a helpful and concise financial assistant for ${userName}. Today is ${todayIST()}. All amounts are Indian Rupees (₹).

DATA AVAILABLE
- ${overview.months.length ? `Transactions from ${overview.months[0]} to ${overview.months[overview.months.length - 1]} (YYYY-MM).` : "The user has no transactions yet."}
- Categories: ${overview.categories.length ? overview.categories.join(", ") : "none"}.

TOOLS
- Use the tools for ANY question about amounts, totals, dates, categories, merchants, trends, comparisons or specific transactions. They are the only source of truth.
- Turn relative dates into exact YYYY-MM-DD ranges from today's date: "this month" = the 1st of this month to today; "last month" = the whole previous calendar month; "this year" = Jan 1 to today; "last N days" = today minus N-1 days to today.
- Use the exact category names listed above (e.g. "food" → "Food").
- Call tools directly without announcing it. You may call several tools at once.
- If a tool returns an error, fix the arguments and try once more.
- Greetings and general questions that need no data: answer without tools.

ANSWERING
- Use only numbers the tools returned. Never invent transactions, amounts or trends.
- Format money as ₹ with Indian digit grouping, e.g. ₹1,25,000.50.
- Mention the date range you used when it was relative ("In October 2026, …").
- Be concise: under 150 words unless a breakdown is asked for. Use a short list or table for several items.
- If nothing matches, say so plainly. For advice, base it on their actual numbers.
`.trim();

/**
 * Builds the message array for either mode.
 * @param {object} p
 * @param {"rag"|"tools"} p.mode
 * @param {string} p.question
 * @param {Array<{role,content}>} p.history  - last few turns, oldest first
 * @param {string} p.userName
 * @param {object} [p.summary]               - rag: buildFinancialSummary() output
 * @param {object[]} [p.relevantTransactions] - rag: semantic matches
 * @param {{months: string[], categories: string[]}} [p.overview] - tools: what data exists
 */
export const buildMessages = ({ mode, question, history = [], userName, summary, relevantTransactions = [], overview }) => {
  const system = mode === "rag"
    ? ragSystemPrompt({ userName, summary, relevantTransactions })
    : toolsSystemPrompt({ userName, overview });

  const messages = [{ role: "system", content: system }];
  for (const turn of history) messages.push({ role: turn.role, content: turn.content });

  if (isGreeting(question)) {
    messages.push({
      role: "system",
      content: "The user is greeting you. Respond with a friendly greeting and offer assistance. DO NOT REFER TO ANY FINANCIAL DATA IN THIS RESPONSE.",
    });
  }

  messages.push({ role: "user", content: question });
  return messages;
};

/**
 * One streamed Groq completion. Content tokens go to onToken as they arrive;
 * tool calls (which Groq may split across chunks) are accumulated and returned.
 *
 * @returns {Promise<{content: string, toolCalls: Array<{id, type, function: {name, arguments}}>, finishReason: string|null}>}
 */
export const streamCompletion = async ({ messages, onToken = () => {}, tools, toolChoice }) => {
  const stream = await groq.chat.completions.create({
    model: getModel(),
    messages,
    stream: true,
    max_tokens: 600,
    temperature: 0.2,
    ...(tools ? { tools, tool_choice: toolChoice ?? "auto" } : {}),
  });

  let content = "";
  let finishReason = null;
  const calls = []; // indexed by tool_call.index

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (!choice) continue;
    const delta = choice.delta ?? {};

    if (delta.content) {
      content += delta.content;
      onToken(delta.content);
    }

    for (const tc of delta.tool_calls ?? []) {
      const slot = (calls[tc.index ?? 0] ??= { id: "", type: "function", function: { name: "", arguments: "" } });
      if (tc.id) slot.id = tc.id;
      if (tc.function?.name) slot.function.name += tc.function.name;
      if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
    }

    if (choice.finish_reason) finishReason = choice.finish_reason;
  }

  return { content, toolCalls: calls.filter(Boolean), finishReason };
};
