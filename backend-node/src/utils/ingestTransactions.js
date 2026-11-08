import { updateTransactionEmbedding } from "../models/Transactions.js";
import { embedText } from "./embedService.js";

/**
 * The text that gets embedded for a transaction. Shared by the ingest script
 * and the import pipeline so both produce identical vectors; changing it
 * requires re-running `node src/scripts/ingest.js` for all rows.
 */
export const buildEmbeddingText = (tx) =>
  `${tx.type === "credit" ? "Credit" : "Debit"} of ${Number(
    tx.amount
  ).toFixed(2)} at ${tx.merchant || "Unknown"} (category: ${
    tx.category || "Uncategorized"
  }) on ${new Date(tx.timestamp).toISOString().split("T")[0]}. Suspicious: ${
    tx.isSuspicious
  }`;

/**
 * Embeds a single transaction's text and stores the vector directly on
 * the transaction row (transactions.embedding column).
 */
export const ingestTransaction = async (tx) => {
  try {
    const vector = await embedText(buildEmbeddingText(tx));

    await updateTransactionEmbedding(tx._id, vector);

    console.log(`Ingested transaction ${tx._id}`);
  } catch (e) {
    console.error(`Error ingesting transaction ${tx._id}:`, e.message);
    throw e;
  }
};
