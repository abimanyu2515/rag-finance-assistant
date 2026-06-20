import { supabase } from "../config/supabase.js";
import {
  findConversationById,
  createConversation,
  addMessage,
} from "../models/Conversations.js";
import { embedText } from "../utils/embedService.js";
import { generateAIResponse } from "../utils/aiService.js";
import { retrieveRelevantTransactions } from "../utils/retrieveContext.js";
import { buildFinancialSummary } from "../utils/financialSummary.js";
import { detectTemporalIntent } from "../utils/intentDetector.js";

export const chatWithAI = async (req, res) => {
  const userId = req.user?.id || req.body.userId;
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
        res.write(`data: ${JSON.stringify({ error: "Conversation not found" })}\n\n`);
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

    // ───────── INTENT DETECTION ─────────
    const temporalIntent = detectTemporalIntent(message);

    let relevantTransactions;
    let summary;

    if (temporalIntent.isTemporal) {
      // Temporal query — bypass vector search, use date-sorted Supabase results
      const order = temporalIntent.order === "asc" ? false : true; // false for asc (default), true for desc

      const [temporalTxnsResult, allTransactionsResult] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .order("timestamp", { ascending: !order })
          .limit(temporalIntent.count),
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .order("timestamp", { ascending: false })
          .limit(100),
      ]);

      if (temporalTxnsResult.error) throw temporalTxnsResult.error;
      if (allTransactionsResult.error) throw allTransactionsResult.error;

      relevantTransactions = temporalTxnsResult.data.map((tx) => ({
        ...tx,
        relevanceScore: 1.0,
      }));
      summary = buildFinancialSummary(allTransactionsResult.data);
    } else {
      // ───────── RAG PIPELINE (parallelized) ─────────
      const [queryEmbedding, allTransactionsResult] = await Promise.all([
        embedText(message),
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .order("timestamp", { ascending: false })
          .limit(100),
      ]);

      if (allTransactionsResult.error) throw allTransactionsResult.error;

      [relevantTransactions, summary] = await Promise.all([
        retrieveRelevantTransactions(userId, queryEmbedding),
        Promise.resolve(buildFinancialSummary(allTransactionsResult.data)),
      ]);
    }

    // Send conversationId early to frontend
    res.write(`data: ${JSON.stringify({ conversationId: conversation._id })}\n\n`);

    // ───────── STREAM AI RESPONSE ─────────
    const aiResponse = await generateAIResponse(
      relevantTransactions,
      message,
      summary,
      res,
      recentHistory
    );

    // Save assistant message after streaming completes — another row,
    // not a re-write of the whole conversation.
    await addMessage(conversation._id, { role: "assistant", content: aiResponse });

    res.write(`data: ${JSON.stringify({ saved: true })}\n\n`);
  } catch (error) {
    console.error("Error in chatWithAI:", error);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: "Failed to process chat message" })}\n\n`);
    }
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
};