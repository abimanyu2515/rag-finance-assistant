import mongoose from "mongoose";
import Conversation from "../models/Conversations.js";
import Transaction from "../models/Transactions.js";
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

  // Convert userId safely
  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(userId);
  } catch (err) {
    return res.status(400).json({ error: "Invalid User ID format" });
  }

  // ───────── SSE HEADERS ─────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    let conversation;

    // ───────── LOAD OR CREATE CONVERSATION ─────────
    if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        userId: userObjectId,
      });

      if (!conversation) {
        res.write(`data: ${JSON.stringify({ error: "Conversation not found" })}\n\n`);
        return res.end();
      }
    } else {
      conversation = new Conversation({
        userId: userObjectId,
        title: message.substring(0, 25),
        messages: [],
      });
    }

    // Get recent history BEFORE pushing current user message
    const recentHistory = conversation.messages.slice(-4);

    // Save user message
    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // ───────── INTENT DETECTION ─────────
    const temporalIntent = detectTemporalIntent(message);

    let relevantTransactions;
    let summary;

    if (temporalIntent.isTemporal) {
      // Temporal query — bypass Qdrant, use date-sorted MongoDB results
      const sortOrder = temporalIntent.order === "asc" ? 1 : -1;

      const [temporalTxns, allTransactions] = await Promise.all([
        Transaction.find({ userId: userObjectId })
          .sort({ timestamp: sortOrder })
          .limit(temporalIntent.count)
          .lean(),
        Transaction.find({ userId: userObjectId })
          .sort({ timestamp: -1 })
          .limit(100),
      ]);

      relevantTransactions = temporalTxns.map((tx) => ({
        ...tx,
        relevanceScore: 1.0,
      }));
      summary = buildFinancialSummary(allTransactions);
    } else {
      // ───────── RAG PIPELINE (parallelized) ─────────
      const [queryEmbedding, allTransactions] = await Promise.all([
        embedText(message),
        Transaction.find({ userId: userObjectId })
          .sort({ timestamp: -1 })
          .limit(100),
      ]);

      [relevantTransactions, summary] = await Promise.all([
        retrieveRelevantTransactions(userObjectId, queryEmbedding),
        Promise.resolve(buildFinancialSummary(allTransactions)),
      ]);
    }

    // Send conversationId early to frontend
    res.write(
      `data: ${JSON.stringify({ conversationId: conversation._id })}\n\n`
    );

    // ───────── STREAM AI RESPONSE ─────────
    const aiResponse = await generateAIResponse(relevantTransactions, message, summary, res, recentHistory);

    // Save assistant message after streaming completes
    conversation.messages.push({
      role: "assistant",
      content: aiResponse,
      timestamp: new Date(),
    });

    await conversation.save();

    res.write(`data: ${JSON.stringify({ saved: true })}\n\n`);
  } catch (error) {
    console.error("Error in chatWithAI:", error);
    if (!res.writableEnded) {
      res.write(
        `data: ${JSON.stringify({ error: "Failed to process chat message" })}\n\n`
      );
    }
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
};