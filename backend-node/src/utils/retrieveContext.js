import { supabase } from "../config/supabase.js";

/**
 * RETRIEVAL PIPELINE — Step 2 of 3
 *
 * Takes an already-embedded query vector and searches Postgres (pgvector)
 * for the most semantically relevant transactions belonging to this user,
 * via the `match_transactions` SQL function (see supabase/schema.sql).
 *
 * This replaces the old Qdrant `qdrantClient.search()` call. Same contract:
 * filtered by userId, top-K results, minimum similarity score floor.
 *
 * @param {string}   userId         - User UUID (used as filter)
 * @param {number[]} queryEmbedding - 768-dim float array from embedText()
 * @param {number}   topK           - How many results to return (default: 8)
 * @returns {Promise<Object[]>}     - Array of transaction objects
 */
export const retrieveRelevantTransactions = async (
  userId,
  queryEmbedding,
  topK = 8
) => {
  const MIN_SCORE = 0.45;

  const { data, error } = await supabase.rpc("match_transactions", {
    p_user_id: userId,
    p_query_embedding: queryEmbedding,
    p_match_count: topK,
    p_min_score: MIN_SCORE,
  });

  if (error) {
    console.error("Error in match_transactions RPC:", error);
    throw error;
  }

  // Map snake_case DB columns -> the camelCase shape the rest of the
  // app expects (same shape aiService.js / financialSummary.js consume).
  return data.map((row) => ({
    _id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    category: row.category,
    merchant: row.merchant,
    name: row.name,
    type: row.type,
    isSuspicious: row.is_suspicious,
    created_at: row.timestamp,
    relevanceScore: row.similarity, // cosine similarity score (0–1)
  }));
};