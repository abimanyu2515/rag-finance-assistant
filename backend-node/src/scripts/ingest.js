import dotenv from 'dotenv';
dotenv.config();

import { setupQdrant } from '../config/qdrant.js';
import connectDB from '../config/db.js'
import Transactions from '../models/Transactions.js';
import { ingestTransaction } from '../utils/ingestTransactions.js';

const run = async () => {
    await connectDB();
    await setupQdrant();

    const transaction = await Transactions.find({})
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