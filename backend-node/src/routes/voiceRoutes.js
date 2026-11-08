import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { LANGUAGES, isSarvamConfigured, isSupportedLanguage, synthesize, transcribe } from "../services/sarvam.js";

const router = express.Router();

const voiceError = (res, label, e) => {
  console.error(`${label}:`, e.message);
  res.status(e.status ?? 502).json({ error: e.message ?? label });
};

// GET /api/voice/config: lets the frontend hide the mic and speaker when Sarvam isn't set up.
router.get("/config", protect, (req, res) => {
  res.json({ enabled: isSarvamConfigured(), languages: LANGUAGES });
});

// POST /api/voice/transcribe?language=ta-IN|auto  (body: raw audio bytes)
router.post(
  "/transcribe",
  protect,
  express.raw({ type: ["audio/*", "video/webm", "application/octet-stream"], limit: "5mb" }),
  async (req, res) => {
    const language = req.query.language ?? "auto";
    if (language !== "auto" && !isSupportedLanguage(language)) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "No audio received" });
    }
    try {
      res.json(await transcribe(req.body, req.get("content-type"), language === "auto" ? undefined : language));
    } catch (e) {
      voiceError(res, "Failed to transcribe audio", e);
    }
  }
);

// POST /api/voice/speak { text, language }  → audio/mpeg
router.post("/speak", protect, async (req, res) => {
  const { text, language } = req.body ?? {};
  if (!isSupportedLanguage(language)) return res.status(400).json({ error: `Unsupported language: ${language}` });
  if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "text is required" });
  try {
    const audio = await synthesize(text, language);
    res.set("Content-Type", "audio/mpeg").send(audio);
  } catch (e) {
    voiceError(res, "Failed to synthesize speech", e);
  }
});

export default router;
