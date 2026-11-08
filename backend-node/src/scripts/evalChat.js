import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findUserByEmail } from "../models/User.js";
import { runChat } from "../services/chatAgent.js";
import { executeTool } from "../utils/financeTools.js";

/**
 * Plain RAG vs tools + RAG on a fixed question set.
 *
 *   node src/scripts/evalChat.js --email you@example.com [--modes rag,tools] [--only 1,4,9]
 *
 * Before running: sign up a test user in the app, load demo data
 * (persona young_professional, 6 months), make sure Ollama is running
 * and the transaction_stats RPC is applied. Writes eval/results.md.
 *
 * Ground truth for each question comes from calling the same read-only
 * tool directly (no LLM). An answer passes when every expected number
 * (±₹1 or 0.5%) and expected text appears in it. Questions without an
 * `expect` block are left for manual grading.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const EVAL_DIR = path.resolve(here, "../../eval");
const PAUSE_MS = 1500; // stay under Groq free-tier rate limits

// ─── CLI ────────────────────────────────────────────────────────────────

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const email = arg("email");
const modes = (arg("modes") ?? "rag,tools").split(",").map((m) => m.trim());
const only = arg("only")?.split(",").map(Number);

if (!email) {
  console.error("Usage: node src/scripts/evalChat.js --email you@example.com [--modes rag,tools] [--only 1,4]");
  process.exit(1);
}

// ─── Dates (IST calendar days, same convention as the tools) ────────────

const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const ymd = (d) => d.toISOString().slice(0, 10);
const dateTokens = () => {
  const today = istToday();
  const [y, m] = today.split("-").map(Number);
  const first = (yy, mm) => new Date(Date.UTC(yy, mm - 1, 1));
  const last = (yy, mm) => new Date(Date.UTC(yy, mm, 0));
  const d30 = new Date(`${today}T00:00:00Z`);
  d30.setUTCDate(d30.getUTCDate() - 29);
  return {
    today,
    this_month_start: ymd(first(y, m)),
    last_month_start: ymd(first(y, m - 1)),
    last_month_end: ymd(last(y, m - 1)),
    prev_month_start: ymd(first(y, m - 2)),
    prev_month_end: ymd(last(y, m - 2)),
    year_start: `${y}-01-01`,
    last_30_start: ymd(d30),
  };
};

const resolve = (value, tokens) =>
  typeof value === "string" ? value.replace(/\{\{(\w+)\}\}/g, (_, k) => tokens[k] ?? `{{${k}}}`) : value;

// ─── Paths like "categories[category=Food].total" or "merchants[0].merchant" ───

const pick = (obj, pathStr) => {
  let cur = obj;
  for (const part of pathStr.split(".")) {
    const m = part.match(/^(\w+)(?:\[(.+)\])?$/);
    if (!m || cur == null) return undefined;
    cur = cur[m[1]];
    if (m[2] != null && Array.isArray(cur)) {
      const sel = m[2];
      if (/^\d+$/.test(sel)) cur = cur[Number(sel)];
      else {
        const [k, v] = sel.split("=");
        cur = cur.find((item) => String(item[k]).toLowerCase() === v.toLowerCase());
      }
    }
  }
  return cur;
};

// ─── Grading ────────────────────────────────────────────────────────────

const numbersIn = (text) =>
  (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((s) => Number(s.replace(/,/g, ""))).filter(Number.isFinite);

const hasNumber = (answer, expected) => {
  const tol = Math.max(1, Math.abs(expected) * 0.005);
  return numbersIn(answer).some((n) => Math.abs(n - Math.abs(expected)) <= tol);
};

const grade = (answer, truth, expect) => {
  if (!expect) return { verdict: "manual", missing: [] };
  const missing = [];
  for (const p of expect.numbers ?? []) {
    const v = pick(truth, p);
    if (typeof v !== "number") missing.push(`${p} (no ground truth)`);
    else if (!hasNumber(answer, v)) missing.push(`${p}=${v}`);
  }
  for (const p of expect.texts ?? []) {
    const v = pick(truth, p);
    if (v == null) missing.push(`${p} (no ground truth)`);
    else if (!answer.toLowerCase().includes(String(v).toLowerCase())) missing.push(`${p}="${v}"`);
  }
  return { verdict: missing.length ? "fail" : "pass", missing };
};

// ─── Run ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ask = async (userId, question, mode) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await runChat({ userId, message: question, history: [], mode });
    } catch (err) {
      if (err?.status === 429 && attempt === 0) {
        console.log("  rate limited, waiting 20s…");
        await sleep(20000);
        continue;
      }
      return { reply: "", toolCalls: [], error: err.message ?? String(err) };
    }
  }
};

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ");

const main = async () => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`No user with email ${email}`);

  const tokens = dateTokens();
  const { questions } = JSON.parse(fs.readFileSync(path.join(EVAL_DIR, "questions.json"), "utf8"));
  const selected = only ? questions.filter((q) => only.includes(q.id)) : questions;

  const rows = [];
  for (const q of selected) {
    const args = Object.fromEntries(Object.entries(q.truth.args).map(([k, v]) => [k, resolve(v, tokens)]));
    const truth = await executeTool(q.truth.tool, args, user.id);
    const row = { q, args, truth, results: {} };

    for (const mode of modes) {
      process.stdout.write(`Q${q.id} [${mode}] ${q.question} … `);
      const out = await ask(user.id, q.question, mode);
      const g = out.error ? { verdict: "error", missing: [out.error] } : grade(out.reply, truth, q.expect);
      row.results[mode] = { ...out, ...g };
      console.log(g.verdict);
      await sleep(PAUSE_MS);
    }
    rows.push(row);
  }

  // ─── Report ───
  const score = (mode) => {
    const graded = rows.filter((r) => ["pass", "fail", "error"].includes(r.results[mode]?.verdict));
    const passed = graded.filter((r) => r.results[mode].verdict === "pass").length;
    return { passed, graded: graded.length, pct: graded.length ? Math.round((passed / graded.length) * 100) : 0 };
  };

  const lines = [];
  lines.push(`# Chat evaluation: plain RAG vs tools + RAG`, "");
  lines.push(`- Run: ${new Date().toISOString()} · today (IST): ${tokens.today}`);
  lines.push(`- Model: \`${process.env.GROQ_MODEL || "qwen/qwen3.8-27b"}\` · user: ${email} · questions: ${rows.length}`);
  lines.push(`- Auto grading: an answer passes when every expected number (±₹1 or 0.5%) and name appears in it. "manual" = grade by hand.`, "");
  lines.push(`## Accuracy`, "", `| Mode | Passed | Auto graded | Accuracy |`, `|---|---|---|---|`);
  for (const mode of modes) {
    const s = score(mode);
    lines.push(`| ${mode} | ${s.passed} | ${s.graded} | ${s.pct}% |`);
  }

  lines.push("", `## By question`, "", `| # | Kind | Question | ${modes.join(" | ")} | Tools used (tools mode) |`, `|---|---|---|${modes.map(() => "---").join("|")}|---|`);
  for (const r of rows) {
    const used = r.results.tools?.toolCalls?.map((t) => t.name).join(", ") || "";
    lines.push(`| ${r.q.id} | ${r.q.kind} | ${cell(r.q.question)} | ${modes.map((m) => r.results[m]?.verdict).join(" | ")} | ${used} |`);
  }

  lines.push("", `## Details`);
  for (const r of rows) {
    lines.push("", `### Q${r.q.id}. ${r.q.question}`, "");
    lines.push(`Ground truth: \`${r.q.truth.tool}(${JSON.stringify(r.args)})\``, "");
    lines.push("```json", JSON.stringify(r.truth, null, 2).slice(0, 1500), "```");
    for (const m of modes) {
      const res = r.results[m];
      lines.push("", `**${m}**: ${res.verdict}${res.missing.length ? ` (missing: ${res.missing.join("; ")})` : ""}`, "");
      if (res.toolCalls?.length) lines.push(`Tool calls: ${res.toolCalls.map((t) => `\`${t.name}(${t.args})\``).join(", ")}`, "");
      lines.push(...(res.reply || "(no answer)").split("\n").map((l) => `> ${l}`));
    }
  }

  fs.writeFileSync(path.join(EVAL_DIR, "results.md"), lines.join("\n") + "\n");
  console.log("");
  for (const mode of modes) {
    const s = score(mode);
    console.log(`${mode}: ${s.passed}/${s.graded} (${s.pct}%)`);
  }
  console.log(`Wrote ${path.join(EVAL_DIR, "results.md")}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
