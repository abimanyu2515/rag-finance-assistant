import express from "express";
import { findTransactionsByUser } from "../models/Transactions.js";
import { protect } from "../middleware/authMiddleware.js";

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

export default router;