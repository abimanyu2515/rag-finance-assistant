import { qdrantClient } from "../config/qdrant.js";
import { embedText } from "./embedService.js";

const COLLECTION_NAME = 'transactions';

export const ingestTransaction = async (tx) => {
    try {
        const text = `${tx.type === 'credit' ? 'Credit' : 'Debit'} of ${tx.amount.toFixed(2)} at ${tx.merchant || 'Unknown'} (category: ${tx.category || 'Uncategorized'}) on ${new Date(tx.timestamp).toISOString().split("T")[0]}. Suspicious: ${tx.isSuspicious}`;
        const vector = await embedText(text);

        const pointId = parseInt(tx._id.toString().slice(-8), 16);

        await qdrantClient.upsert(COLLECTION_NAME, {
            wait: true,
            points: [
                {
                    id: pointId,
                    vector,
                    payload: {
                        mongoId: tx._id.toString(),
                        userId: tx.userId.toString(),
                        amount: tx.amount,
                        category: tx.category,
                        merchant: tx.merchant,
                        type: tx.type,
                        timestamp: tx.timestamp?.toISOString() || new Date().toISOString(),
                        isSuspicious: tx.isSuspicious
                    }
                }
            ]
        })
        console.log(`Ingested transaction ${tx._id} into Qdrant`)
    } catch (e) {
        console.error('Error ingesting transactions:', e);
    }
}