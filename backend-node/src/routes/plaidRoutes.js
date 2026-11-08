import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { createLinkToken, exchangePublicToken, listItems, syncAllItems } from "../services/plaid.js";

const router = express.Router();

const plaidError = (res, label, e) => {
  console.error(`${label}:`, e.response?.data ?? e.message);
  res.status(e.status ?? 502).json({
    error: e.response?.data?.error_message ?? e.message ?? label,
  });
};

// GET /api/plaid/items — linked bank connections (no tokens)
router.get("/items", protect, async (req, res) => {
  try {
    res.json(await listItems(req.user.id));
  } catch (e) {
    plaidError(res, "Failed to list Plaid items", e);
  }
});

// POST /api/plaid/link-token — token for the Plaid Link widget
router.post("/link-token", protect, async (req, res) => {
  try {
    res.json({ linkToken: await createLinkToken(req.user.id) });
  } catch (e) {
    plaidError(res, "Failed to create link token", e);
  }
});

// POST /api/plaid/exchange { publicToken, institutionName } — store item, then sync
router.post("/exchange", protect, async (req, res) => {
  const { publicToken, institutionName } = req.body ?? {};
  if (!publicToken) return res.status(400).json({ error: "publicToken is required" });
  try {
    res.json(await exchangePublicToken(req.user.id, publicToken, institutionName));
  } catch (e) {
    plaidError(res, "Failed to exchange public token", e);
  }
});

// POST /api/plaid/sync — pull new transactions for every linked item
router.post("/sync", protect, async (req, res) => {
  try {
    res.json(await syncAllItems(req.user.id));
  } catch (e) {
    plaidError(res, "Failed to sync Plaid transactions", e);
  }
});

export default router;
