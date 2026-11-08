/**
 * Sarvam AI speech services for voice chat: speech to text (saaras) and
 * text to speech (bulbul) in English + 5 Indian languages.
 * Docs: https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe
 *       https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert
 */

const BASE_URL = "https://api.sarvam.ai";

// Single allowlist for the voice routes and the chat prompt's reply language.
export const LANGUAGES = {
  "en-IN": "English",
  "hi-IN": "Hindi",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
  "kn-IN": "Kannada",
  "ml-IN": "Malayalam",
};

export const isSupportedLanguage = (code) => Object.hasOwn(LANGUAGES, code ?? "");

export const isSarvamConfigured = () => Boolean(process.env.SARVAM_API_KEY);

const assertConfigured = () => {
  if (!isSarvamConfigured()) {
    throw Object.assign(
      new Error("Voice is not configured: missing SARVAM_API_KEY in backend-node/.env (restart the server after editing it)."),
      { status: 503 }
    );
  }
};

const sarvamFetch = async (path, init) => {
  assertConfigured();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "api-subscription-key": process.env.SARVAM_API_KEY, ...init.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body?.error?.message ?? body?.message ?? body?.detail ?? `Sarvam request failed (${res.status})`;
    throw Object.assign(new Error(typeof message === "string" ? message : JSON.stringify(message)), {
      status: res.status >= 500 ? 502 : res.status,
    });
  }
  return body;
};

/**
 * @param {Buffer} buffer       - recorded audio (webm/opus from the browser, or any Sarvam-supported format)
 * @param {string} mimeType
 * @param {string} [languageCode] - one of LANGUAGES, or omitted for auto-detect
 * @returns {Promise<{transcript: string, languageCode: string|null}>}
 */
export const transcribe = async (buffer, mimeType, languageCode) => {
  const ext = mimeType?.includes("ogg") ? "ogg" : mimeType?.includes("wav") ? "wav" : mimeType?.includes("mp4") ? "m4a" : "webm";
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType || "audio/webm" }), `speech.${ext}`);
  form.append("model", process.env.SARVAM_STT_MODEL || "saaras:v3");
  // codemix keeps English words ("food", "Swiggy") in Latin script inside Tamil/Hindi text,
  // which helps the LLM map them to category and merchant names.
  form.append("mode", process.env.SARVAM_STT_MODE || "codemix");
  form.append("language_code", isSupportedLanguage(languageCode) ? languageCode : "unknown");

  const body = await sarvamFetch("/speech-to-text", { method: "POST", body: form });
  const detected = body?.language_code;
  return {
    transcript: (body?.transcript ?? "").trim(),
    languageCode: isSupportedLanguage(detected) ? detected : null,
  };
};

const MAX_TTS_CHARS = 2500; // bulbul:v3 / v4-flash limit per request

/** Markdown → plain sentences that read well aloud. */
export const toSpeechText = (markdown) => {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/gm, "") // table separator rows
    .replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_, row) => row.split("|").map((c) => c.trim()).filter(Boolean).join(", ") + ".")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(\S.*?\S|\S)\1/g, "$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  if (text.length <= MAX_TTS_CHARS) return text;
  // Cut on the last sentence end (., ?, !, । Hindi danda, newline) before the limit.
  const head = text.slice(0, MAX_TTS_CHARS);
  const cut = Math.max(...[".", "?", "!", "।", "\n"].map((p) => head.lastIndexOf(p)));
  return cut > MAX_TTS_CHARS / 2 ? head.slice(0, cut + 1) : head;
};

/**
 * @param {string} text         - assistant reply (markdown allowed)
 * @param {string} languageCode - one of LANGUAGES
 * @returns {Promise<Buffer>} mp3 audio
 */
export const synthesize = async (text, languageCode) => {
  const speech = toSpeechText(text);
  if (!speech) throw Object.assign(new Error("Nothing to read aloud"), { status: 400 });

  const body = await sarvamFetch("/text-to-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: speech,
      language_code: languageCode,
      model: process.env.SARVAM_TTS_MODEL || "bulbul:v3",
      speaker: process.env.SARVAM_TTS_SPEAKER || "shubh",
      output_audio_codec: "mp3",
    }),
  });

  const audio = body?.audios?.[0];
  if (!audio) throw Object.assign(new Error("Sarvam returned no audio"), { status: 502 });
  return Buffer.from(audio, "base64");
};
