import { upsertTransactions, updateTransactionEmbedding } from "../models/Transactions.js";
import { embedTexts } from "../utils/embedService.js";
import { buildEmbeddingText } from "../utils/ingestTransactions.js";

const INSERT_CHUNK = 500;
const EMBED_CHUNK = 64;
const SUSPICIOUS_ABSOLUTE_LIMIT = 200000; // ₹2,00,000
const SUSPICIOUS_MEDIAN_MULTIPLIER = 4;
const MIN_CATEGORY_SAMPLES = 4;

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Flags debits that are far above their category's median within the batch,
 * or above an absolute limit. Only applied to rows whose source did not set
 * isSuspicious itself (the demo generator does; Plaid does not).
 */
const flagSuspicious = (txs) => {
  const byCategory = new Map();
  for (const tx of txs) {
    if (tx.type !== "debit") continue;
    const key = tx.category || "Uncategorized";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(tx.amount);
  }
  const medians = new Map(
    [...byCategory].map(([k, amounts]) => [k, amounts.length >= MIN_CATEGORY_SAMPLES ? median(amounts) : null])
  );

  return txs.map((tx) => {
    if (typeof tx.isSuspicious === "boolean") return tx;
    let suspicious = false;
    if (tx.type === "debit") {
      const m = medians.get(tx.category || "Uncategorized");
      suspicious =
        tx.amount > SUSPICIOUS_ABSOLUTE_LIMIT ||
        (m != null && tx.amount > m * SUSPICIOUS_MEDIAN_MULTIPLIER);
    }
    return { ...tx, isSuspicious: suspicious };
  });
};

const isValid = (tx) =>
  tx.externalId &&
  Number.isFinite(tx.amount) &&
  tx.amount > 0 &&
  (tx.type === "credit" || tx.type === "debit") &&
  !Number.isNaN(new Date(tx.timestamp).getTime());

/**
 * Shared import pipeline for every transaction source.
 *
 * @param {string} userId
 * @param {'demo'|'plaid'|'manual'} source
 * @param {Array<{externalId, amount, type, category, merchant, name, timestamp, isSuspicious?}>} txs
 * @returns {{ inserted: number, skipped: number, invalid: number, embedded: number, embedError?: string }}
 */
export const importTransactions = async (userId, source, txs) => {
  const valid = txs.filter(isValid);
  const invalid = txs.length - valid.length;

  const rows = flagSuspicious(valid).map((tx) => ({
    user_id: userId,
    source,
    external_id: String(tx.externalId),
    amount: Math.round(tx.amount * 100) / 100,
    type: tx.type,
    category: tx.category ?? null,
    merchant: tx.merchant ?? null,
    name: tx.name ?? tx.merchant ?? null,
    is_suspicious: tx.isSuspicious,
    timestamp: new Date(tx.timestamp).toISOString(),
  }));

  const inserted = [];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    inserted.push(...(await upsertTransactions(rows.slice(i, i + INSERT_CHUNK))));
  }

  // Embed right away so new rows are visible to semantic search. If Ollama is
  // down, the rows are kept and `node src/scripts/ingest.js` can backfill.
  let embedded = 0;
  let embedError;
  try {
    for (let i = 0; i < inserted.length; i += EMBED_CHUNK) {
      const chunk = inserted.slice(i, i + EMBED_CHUNK);
      const vectors = await embedTexts(chunk.map(buildEmbeddingText));
      await Promise.all(chunk.map((tx, j) => updateTransactionEmbedding(tx._id, vectors[j])));
      embedded += chunk.length;
    }
  } catch (e) {
    console.error("Embedding during import failed:", e.message);
    embedError = e.message;
  }

  return {
    inserted: inserted.length,
    skipped: valid.length - inserted.length,
    invalid,
    embedded,
    ...(embedError && { embedError }),
  };
};
