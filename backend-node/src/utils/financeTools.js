import { supabase } from "../config/supabase.js";
import { fromRow } from "../models/Transactions.js";
import { embedText } from "./embedService.js";
import { retrieveRelevantTransactions } from "./retrieveContext.js";

/**
 * Read-only tools the chat model can call (see services/chatAgent.js).
 *
 * Every handler gets `userId` from the server (req.user), never from the
 * model, and every query filters by it — RLS is bypassed by the
 * service_role key, so this filter is the only thing scoping the data.
 *
 * Dates are calendar days in India time (YYYY-MM-DD), `to` is inclusive.
 * Bad arguments come back to the model as { error } so it can retry,
 * instead of failing the whole chat turn.
 */

const TZ = "+05:30"; // the app's data is INR / India-local
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LIST_MAX = 50;

class ToolArgError extends Error {}

// ─── Argument helpers ───────────────────────────────────────────────────

const parseDate = (value, field) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ToolArgError(`${field} must be a date like 2026-03-31`);
  }
  return value;
};

const requireDate = (value, field) => {
  const d = parseDate(value, field);
  if (!d) throw new ToolArgError(`${field} is required (YYYY-MM-DD)`);
  return d;
};

const checkRange = (from, to, fromField = "from", toField = "to") => {
  if (from && to && from > to) throw new ToolArgError(`${fromField} must be on or before ${toField}`);
};

// Start of `day` in IST, and start of the day AFTER `day` (so `to` is inclusive).
const startOfDay = (day) => (day ? `${day}T00:00:00${TZ}` : null);
const endOfDay = (day) => {
  if (!day) return null;
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return `${next.toISOString().slice(0, 10)}T00:00:00${TZ}`;
};

const oneOf = (value, allowed, field, fallback) => {
  if (value == null || value === "") return fallback;
  if (!allowed.includes(value)) throw new ToolArgError(`${field} must be one of: ${allowed.join(", ")}`);
  return value;
};

const clampInt = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : Math.min(Math.max(n, min), max);
};

const optNumber = (value, field) => {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ToolArgError(`${field} must be a number`);
  return n;
};

// Free-text filters: trimmed, length-capped, LIKE wildcards stripped so the
// model can't turn "exact category" into "match everything".
const optText = (value, field) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new ToolArgError(`${field} must be a string`);
  const clean = value.replace(/[%_*\\]/g, "").trim().slice(0, 80);
  return clean || null;
};

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const pctChange = (from, to) => (from === 0 ? null : round2(((to - from) / from) * 100));

// ─── Data access ────────────────────────────────────────────────────────

// Wraps the transaction_stats RPC (schema.sql). Rows: { group_key, type, total, txn_count }.
const stats = async (userId, { from, to, groupBy = "none", type = null, category = null, merchant = null }) => {
  const { data, error } = await supabase.rpc("transaction_stats", {
    p_user_id: userId,
    p_from: startOfDay(from),
    p_to: endOfDay(to),
    p_group_by: groupBy,
    p_type: type,
    p_category: category,
    p_merchant: merchant,
  });
  if (error?.code === "PGRST202") {
    throw new Error("transaction_stats RPC not found: run section 7b of backend-node/src/supabase/schema.sql in the Supabase SQL editor.");
  }
  if (error) throw error;
  return data.map((r) => ({ key: r.group_key, type: r.type, total: Number(r.total), count: Number(r.txn_count) }));
};

// Collapse rows to one entry per key (summing credit/debit if both present).
const byKey = (rows) => {
  const map = new Map();
  for (const r of rows) {
    const cur = map.get(r.key) ?? { total: 0, count: 0 };
    map.set(r.key, { total: cur.total + r.total, count: cur.count + r.count });
  }
  return [...map].map(([key, v]) => ({ key, total: round2(v.total), count: v.count })).sort((a, b) => b.total - a.total);
};

const totalsFromRows = (rows) => {
  const sum = (type, f) => rows.filter((r) => r.type === type).reduce((s, r) => s + r[f], 0);
  const credit = round2(sum("credit", "total"));
  const debit = round2(sum("debit", "total"));
  return {
    total_credit: credit,
    total_debit: debit,
    net: round2(credit - debit),
    credit_count: sum("credit", "count"),
    debit_count: sum("debit", "count"),
  };
};

const compactTx = (t) => ({
  date: t.timestamp?.slice(0, 10) ?? null,
  type: t.type,
  amount: round2(t.amount),
  merchant: t.merchant,
  category: t.category,
  suspicious: Boolean(t.isSuspicious),
});

// ─── Tool handlers ──────────────────────────────────────────────────────

const handlers = {
  async totals_for_range(userId, args) {
    const from = requireDate(args.from, "from");
    const to = requireDate(args.to, "to");
    checkRange(from, to);
    return { from, to, ...totalsFromRows(await stats(userId, { from, to })) };
  },

  async spend_by_category(userId, args) {
    const from = requireDate(args.from, "from");
    const to = requireDate(args.to, "to");
    checkRange(from, to);
    const type = oneOf(args.type, ["debit", "credit"], "type", "debit");
    const rows = byKey(await stats(userId, { from, to, groupBy: "category", type }));
    return {
      from, to, type,
      total: round2(rows.reduce((s, r) => s + r.total, 0)),
      categories: rows.map((r) => ({ category: r.key, total: r.total, count: r.count })),
    };
  },

  async top_merchants(userId, args) {
    const from = requireDate(args.from, "from");
    const to = requireDate(args.to, "to");
    checkRange(from, to);
    const type = oneOf(args.type, ["debit", "credit"], "type", "debit");
    const category = optText(args.category, "category");
    const limit = clampInt(args.limit, 1, 20, 5);
    const rows = byKey(await stats(userId, { from, to, groupBy: "merchant", type, category }));
    return {
      from, to, type, category,
      merchants: rows.slice(0, limit).map((r) => ({ merchant: r.key, total: r.total, count: r.count })),
      merchants_in_range: rows.length,
    };
  },

  async monthly_totals(userId, args) {
    const from = requireDate(args.from, "from");
    const to = requireDate(args.to, "to");
    checkRange(from, to);
    const category = optText(args.category, "category");
    const rows = await stats(userId, { from, to, groupBy: "month", category });
    const months = [...new Set(rows.map((r) => r.key))].sort();
    return {
      from, to, category,
      months: months.map((m) => ({ month: m, ...totalsFromRows(rows.filter((r) => r.key === m)) })),
    };
  },

  async compare_periods(userId, args) {
    const aFrom = requireDate(args.a_from, "a_from");
    const aTo = requireDate(args.a_to, "a_to");
    const bFrom = requireDate(args.b_from, "b_from");
    const bTo = requireDate(args.b_to, "b_to");
    checkRange(aFrom, aTo, "a_from", "a_to");
    checkRange(bFrom, bTo, "b_from", "b_to");
    const type = oneOf(args.type, ["debit", "credit"], "type", "debit");
    const groupBy = oneOf(args.group_by, ["none", "category"], "group_by", "none");

    const [a, b] = await Promise.all([
      stats(userId, { from: aFrom, to: aTo, groupBy, type }),
      stats(userId, { from: bFrom, to: bTo, groupBy, type }),
    ]);
    const aRows = byKey(a);
    const bRows = byKey(b);
    const aTotal = round2(aRows.reduce((s, r) => s + r.total, 0));
    const bTotal = round2(bRows.reduce((s, r) => s + r.total, 0));

    const result = {
      type,
      period_a: { from: aFrom, to: aTo, total: aTotal, count: aRows.reduce((s, r) => s + r.count, 0) },
      period_b: { from: bFrom, to: bTo, total: bTotal, count: bRows.reduce((s, r) => s + r.count, 0) },
      change_a_to_b: round2(bTotal - aTotal),
      pct_change_a_to_b: pctChange(aTotal, bTotal),
    };

    if (groupBy === "category") {
      const keys = [...new Set([...aRows, ...bRows].map((r) => r.key))];
      const get = (rows, k) => rows.find((r) => r.key === k)?.total ?? 0;
      result.by_category = keys
        .map((k) => {
          const av = get(aRows, k);
          const bv = get(bRows, k);
          return { category: k, a: av, b: bv, change: round2(bv - av), pct_change: pctChange(av, bv) };
        })
        .sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
    }
    return result;
  },

  async list_transactions(userId, args) {
    const from = parseDate(args.from, "from");
    const to = parseDate(args.to, "to");
    checkRange(from, to);
    const type = oneOf(args.type, ["debit", "credit"], "type", null);
    const category = optText(args.category, "category");
    const merchant = optText(args.merchant, "merchant");
    const minAmount = optNumber(args.min_amount, "min_amount");
    const maxAmount = optNumber(args.max_amount, "max_amount");
    const sort = oneOf(args.sort, ["newest", "oldest", "largest", "smallest"], "sort", "newest");
    const limit = clampInt(args.limit, 1, LIST_MAX, 10);

    let q = supabase
      .from("transactions")
      .select("id, user_id, amount, category, merchant, name, type, is_suspicious, timestamp", { count: "exact" })
      .eq("user_id", userId);

    if (from) q = q.gte("timestamp", startOfDay(from));
    if (to) q = q.lt("timestamp", endOfDay(to));
    if (type) q = q.eq("type", type);
    if (category) q = q.ilike("category", category);
    if (merchant) q = q.ilike("merchant", `%${merchant}%`);
    if (minAmount != null) q = q.gte("amount", minAmount);
    if (maxAmount != null) q = q.lte("amount", maxAmount);
    if (args.suspicious_only === true) q = q.eq("is_suspicious", true);

    const [column, ascending] = {
      newest: ["timestamp", false],
      oldest: ["timestamp", true],
      largest: ["amount", false],
      smallest: ["amount", true],
    }[sort];

    const { data, error, count } = await q.order(column, { ascending }).limit(limit);
    if (error) throw error;

    return {
      sort,
      matching_count: count ?? data.length,
      returned: data.length,
      transactions: data.map(fromRow).map(compactTx),
    };
  },

  async search_transactions(userId, args) {
    const query = optText(args.query, "query");
    if (!query) throw new ToolArgError("query is required");
    const embedding = await embedText(query);
    const rows = await retrieveRelevantTransactions(userId, embedding);
    return {
      query,
      note: "Semantic matches only (top 8, may be incomplete). Use the other tools for totals.",
      transactions: rows.map((t) => ({ ...compactTx(t), similarity: round2(t.relevanceScore) })),
    };
  },
};

// ─── Tool schemas for Groq (OpenAI function-calling format) ─────────────

const dateProp = (description) => ({ type: "string", description: `${description} (YYYY-MM-DD)` });
const fn = (name, description, properties, required = []) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } },
});

export const TOOL_DEFINITIONS = [
  fn(
    "totals_for_range",
    "Total money in (credit) and out (debit), net, and counts for a date range. Use for 'how much did I spend/earn' questions without a category.",
    { from: dateProp("First day, inclusive"), to: dateProp("Last day, inclusive") },
    ["from", "to"]
  ),
  fn(
    "spend_by_category",
    "Totals per category for a date range, largest first. Use for 'how much on food', 'where does my money go'. Pick the category from the result rather than guessing.",
    {
      from: dateProp("First day, inclusive"),
      to: dateProp("Last day, inclusive"),
      type: { type: "string", enum: ["debit", "credit"], description: "debit = spending (default), credit = income" },
    },
    ["from", "to"]
  ),
  fn(
    "top_merchants",
    "Merchants ranked by total amount for a date range, optionally within one category.",
    {
      from: dateProp("First day, inclusive"),
      to: dateProp("Last day, inclusive"),
      type: { type: "string", enum: ["debit", "credit"], description: "Default debit" },
      category: { type: "string", description: "Exact category name, optional" },
      limit: { type: "integer", description: "How many merchants, 1-20, default 5" },
    },
    ["from", "to"]
  ),
  fn(
    "monthly_totals",
    "Credit, debit and net for each calendar month in a range. Use for trends and 'which month did I spend the most'.",
    {
      from: dateProp("First day, inclusive"),
      to: dateProp("Last day, inclusive"),
      category: { type: "string", description: "Exact category name, optional" },
    },
    ["from", "to"]
  ),
  fn(
    "compare_periods",
    "Compare totals between period A and period B (e.g. last month vs this month), overall or per category. Change is B minus A.",
    {
      a_from: dateProp("Period A first day"),
      a_to: dateProp("Period A last day"),
      b_from: dateProp("Period B first day"),
      b_to: dateProp("Period B last day"),
      type: { type: "string", enum: ["debit", "credit"], description: "Default debit" },
      group_by: { type: "string", enum: ["none", "category"], description: "Default none" },
    },
    ["a_from", "a_to", "b_from", "b_to"]
  ),
  fn(
    "list_transactions",
    "List individual transactions with filters and sorting. Use for 'last N transactions', 'largest purchase', 'suspicious transactions', 'payments to X'.",
    {
      from: dateProp("First day, inclusive, optional"),
      to: dateProp("Last day, inclusive, optional"),
      type: { type: "string", enum: ["debit", "credit"] },
      category: { type: "string", description: "Exact category name" },
      merchant: { type: "string", description: "Part of the merchant name" },
      min_amount: { type: "number" },
      max_amount: { type: "number" },
      suspicious_only: { type: "boolean" },
      sort: { type: "string", enum: ["newest", "oldest", "largest", "smallest"], description: "Default newest" },
      limit: { type: "integer", description: `1-${LIST_MAX}, default 10` },
    }
  ),
  fn(
    "search_transactions",
    "Semantic search over transaction descriptions. Use only for fuzzy questions about kinds of purchases (e.g. 'streaming services', 'anything travel related'), never for totals.",
    { query: { type: "string", description: "What to look for, in English" } },
    ["query"]
  ),
];

/**
 * What data exists for this user, for the system prompt: the months that
 * have transactions and the exact category names (so the model passes
 * "Food", not "food expenses").
 * @returns {Promise<{months: string[], categories: string[]}>}
 */
export const getDataOverview = async (userId) => {
  const [months, categories] = await Promise.all([
    stats(userId, { groupBy: "month" }),
    stats(userId, { groupBy: "category" }),
  ]);
  return {
    months: [...new Set(months.map((r) => r.key))].sort(),
    categories: byKey(categories).map((r) => r.key),
  };
};

// Short progress labels for the chat UI ({status} SSE event).
export const TOOL_STATUS = {
  totals_for_range: "Adding up your totals…",
  spend_by_category: "Checking spending by category…",
  top_merchants: "Ranking your merchants…",
  monthly_totals: "Looking at month by month totals…",
  compare_periods: "Comparing the two periods…",
  list_transactions: "Finding the matching transactions…",
  search_transactions: "Searching your transactions…",
};

/**
 * Runs one tool call. Never throws: returns the result object, or { error }.
 * @param {string} name     - tool name from the model
 * @param {string|object} rawArgs - JSON string (as Groq sends it) or object
 * @param {string} userId   - authenticated user id (server-side only)
 */
export const executeTool = async (name, rawArgs, userId) => {
  const handler = handlers[name];
  if (!handler) return { error: `Unknown tool "${name}"` };
  if (!userId) return { error: "No user" };

  let args;
  try {
    args = typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : rawArgs ?? {};
    if (typeof args !== "object" || Array.isArray(args)) throw new Error();
  } catch {
    return { error: "Arguments must be a JSON object" };
  }

  try {
    return await handler(userId, args);
  } catch (err) {
    if (err instanceof ToolArgError) return { error: err.message };
    console.error(`Tool ${name} failed:`, err);
    return { error: "The lookup failed. Answer with what you have or say the data is unavailable." };
  }
};
