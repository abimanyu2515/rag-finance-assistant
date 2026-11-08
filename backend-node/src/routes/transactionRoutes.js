import express from "express";
import { deleteTransactionsBySource, findTransactionsByUser } from "../models/Transactions.js";
import { protect } from "../middleware/authMiddleware.js";
import { DEMO_PERSONAS, generateDemoTransactions } from "../services/demoData.js";
import { importTransactions } from "../services/importTransactions.js";
import { removeItems } from "../services/plaid.js";

const router = express.Router();

// GET /api/transactions — returns all transactions for the authenticated user
router.get("/", protect, async (req, res) => {
    try {
        const transactions = await findTransactionsByUser(req.user.id, {
            sort: "desc",
            limit: 100,
        });
        res.json(transactions);
    } catch (err) {
        console.error("Error fetching transactions:", err);
        res.status(500).json({ error: "Failed to fetch transactions" });
    }
});

// POST /api/transactions/demo { persona, months } — generate + import synthetic INR data
router.post("/demo", protect, async (req, res) => {
    const { persona = "young_professional", months = 6 } = req.body ?? {};
    if (!DEMO_PERSONAS.includes(persona)) {
        return res.status(400).json({ error: `persona must be one of: ${DEMO_PERSONAS.join(", ")}` });
    }
    try {
        const txs = generateDemoTransactions({ persona, months });
        res.json(await importTransactions(req.user.id, "demo", txs));
    } catch (err) {
        console.error("Error loading demo data:", err);
        res.status(500).json({ error: "Failed to load demo data" });
    }
});

// DELETE /api/transactions?source=demo|plaid — remove imported data from one source
router.delete("/", protect, async (req, res) => {
    const { source } = req.query;
    if (source !== "demo" && source !== "plaid") {
        return res.status(400).json({ error: "source must be 'demo' or 'plaid'" });
    }
    try {
        if (source === "plaid") await removeItems(req.user.id);
        const deleted = await deleteTransactionsBySource(req.user.id, source);
        res.json({ deleted });
    } catch (err) {
        console.error("Error deleting transactions:", err);
        res.status(500).json({ error: "Failed to delete transactions" });
    }
});

export default router;
