import { qdrantClient } from "../config/qdrant.js";

const COLLECTION_NAME = "transactions";

/**
 * RETRIEVAL PIPELINE — Step 2 of 3
 *
 * Takes an already-embedded query vector and searches Qdrant for the
 * most semantically relevant transactions belonging to this user.
 *
 * @param {string}   userId         - MongoDB userId string (used as filter)
 * @param {number[]} queryEmbedding - 768-dim float array from embedText()
 * @param {number}   topK           - How many results to return (default: 8)
 * @returns {Promise<Object[]>}     - Array of transaction payload objects
 */
export const retrieveRelevantTransactions = async (
  userId,
  queryEmbedding,
  topK = 8
) => {
  const results = await qdrantClient.search(COLLECTION_NAME, {
    vector: queryEmbedding,       // the embedded user query
    limit: topK,                  // return top 8 closest matches
    filter: {
      must: [
        {
          key: "userId",          // ⚠️ CRITICAL: only search THIS user's data
          match: {
            value: userId.toString(),
          },
        },
      ],
    },
    with_payload: true,           // return the metadata (amount, merchant, etc.)
    with_vector: false,           // don't return the raw vectors (not needed)
  });

  // Each result has: { id, score, payload }
  // We only need the payload (transaction metadata)
  // Filter out low-relevance results to avoid injecting noise into the prompt
  const MIN_SCORE = 0.45;
  return results
    .filter((r) => r.score >= MIN_SCORE)
    .map((r) => ({
      ...r.payload,
      relevanceScore: r.score,      // cosine similarity score (0–1), useful for debugging
    }));
};