import dotenv from 'dotenv';
dotenv.config();

import { getAllTransactionsForIngest } from '../models/Transactions.js';
import { ingestTransaction } from '../utils/ingestTransactions.js';

const run = async () => {
    const transaction = await getAllTransactionsForIngest();
    console.log(`Found ${transaction.length} transactions to ingest.`)

    for (const tx of transaction) {
        await ingestTransaction(tx);
    }

    console.log("Ingestion Complete.");
    process.exit(0);
}

run().catch((e) => {
    console.error("Error during ingestion: ", e)
    process.exit(1);
})