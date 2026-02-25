import express from "express";
import Transaction from "../models/Transactions.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/transactions — returns all transactions for the authenticated user
router.get("/", protect, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.id })
            .sort({ timestamp: -1 });
        res.json(transactions);
    } catch (err) {
        console.error("Error fetching transactions:", err);
        res.status(500).json({ error: "Failed to fetch transactions" });
    }
});

export default router;
