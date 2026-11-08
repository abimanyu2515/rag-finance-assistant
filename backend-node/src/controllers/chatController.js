import {
  findConversationById,
  createConversation,
  addMessage,
} from "../models/Conversations.js";
import { runChat } from "../services/chatAgent.js";

// SSE event order (frontend app/(root)/ai-assistant/page.tsx relies on it):
//   {conversationId} → {status}* → {token}* → {done} → {saved};  {error} on failure.
const send = (res, payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

export const chatWithAI = async (req, res) => {
  // Only the verified JWT decides whose data the tools can read.
  const userId = req.user?.id;
  const { message, conversationId } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: "User ID and message are required" });
  }

  // ───────── SSE HEADERS ─────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    let conversation;

    // ───────── LOAD OR CREATE CONVERSATION ─────────
    if (conversationId) {
      conversation = await findConversationById(conversationId, userId);
      if (!conversation) {
        send(res, { error: "Conversation not found" });
        return res.end();
      }
    } else {
      conversation = await createConversation(userId, message.substring(0, 25));
    }

    // Recent history BEFORE the current message is persisted —
    // conversation.messages already comes back oldest-first from the model.
    const recentHistory = conversation.messages.slice(-4);

    // Persist the user's message now (separate row in `messages`, not an
    // array mutation — the DB trigger bumps conversations.updated_at).
    await addMessage(conversation._id, { role: "user", content: message });

    send(res, { conversationId: conversation._id });

    // ───────── TOOLS / RAG + STREAMED ANSWER ─────────
    const { reply } = await runChat({
      userId,
      message,
      history: recentHistory,
      mode: process.env.CHAT_MODE === "rag" ? "rag" : "tools",
      onToken: (token) => send(res, { token }),
      onStatus: (status) => send(res, { status }),
    });

    send(res, { done: true });

    // Save assistant message after streaming completes — another row,
    // not a re-write of the whole conversation.
    await addMessage(conversation._id, { role: "assistant", content: reply });

    send(res, { saved: true });
  } catch (error) {
    console.error("Error in chatWithAI:", error);
    if (!res.writableEnded) {
      send(res, { error: "Failed to process chat message" });
    }
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
};
