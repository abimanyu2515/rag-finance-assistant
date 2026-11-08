import crypto from "node:crypto";
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from "plaid";
import {
  createPlaidItem,
  deletePlaidItemsByUser,
  findPlaidItemsByUser,
  updatePlaidItemCursor,
} from "../models/PlaidItems.js";
import { importTransactions } from "./importTransactions.js";

/**
 * Plaid Sandbox connector. Plaid data is USD from US institutions; amounts are
 * converted to INR at a fixed demo rate (USD_TO_INR) so they sit alongside the
 * rest of the app, which formats everything as INR.
 */

const REQUIRED_ENV = ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_TOKEN_KEY"];

// Fail before Link opens rather than after the user has linked a bank.
const assertConfigured = () => {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    throw Object.assign(
      new Error(`Plaid is not configured: missing ${missing.join(", ")} in backend-node/.env (restart the server after editing it).`),
      { status: 503 }
    );
  }
  if (!PlaidEnvironments[process.env.PLAID_ENV || "sandbox"]) {
    throw Object.assign(new Error(`PLAID_ENV must be one of: ${Object.keys(PlaidEnvironments).join(", ")}`), { status: 503 });
  }
  tokenKey();
};

let client;
const plaid = () => {
  if (client) return client;
  assertConfigured();
  const { PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV = "sandbox" } = process.env;
  client = new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[PLAID_ENV],
      baseOptions: { headers: { "PLAID-CLIENT-ID": PLAID_CLIENT_ID, "PLAID-SECRET": PLAID_SECRET } },
    })
  );
  return client;
};

// ---- access-token encryption (AES-256-GCM) ---------------------------------

const tokenKey = () => {
  const hex = process.env.PLAID_TOKEN_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw Object.assign(new Error("PLAID_TOKEN_KEY must be 64 hex chars (32 bytes)."), { status: 503 });
  }
  return Buffer.from(hex, "hex");
};

const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64")).join(".");
};

const decrypt = (payload) => {
  const [iv, tag, ciphertext] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", tokenKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
};

// ---- mapping ----------------------------------------------------------------

const titleCase = (s) =>
  s ? s.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") : null;

const toNormalized = (t) => {
  const rate = Number(process.env.USD_TO_INR) || 83;
  // Plaid: positive amount = money leaving the account
  return {
    externalId: t.transaction_id,
    type: t.amount > 0 ? "debit" : "credit",
    amount: Math.abs(t.amount) * rate,
    merchant: t.merchant_name ?? t.name,
    name: t.name,
    // Plaid's catch-all "OTHER" carries no meaning; store it as uncategorized.
    category:
      t.personal_finance_category?.primary && t.personal_finance_category.primary !== "OTHER"
        ? titleCase(t.personal_finance_category.primary)
        : null,
    timestamp: t.datetime ?? t.authorized_datetime ?? t.date,
  };
};

// ---- public API -------------------------------------------------------------

export const createLinkToken = async (userId) => {
  assertConfigured();
  const { data } = await plaid().linkTokenCreate({
    user: { client_user_id: String(userId) },
    client_name: "QueryFi",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return data.link_token;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Pulls everything new since the stored cursor. Only `added` is imported for
 * now. TODO: apply `modified` and `removed` (update/delete by external_id).
 */
const syncItem = async (userId, item) => {
  const accessToken = decrypt(item.accessTokenEnc);
  const startCursor = item.syncCursor ?? undefined;

  // A freshly linked item may not be ready yet; poll briefly.
  for (let attempt = 0; attempt < 10; attempt++) {
    let cursor = startCursor;
    let added = [];
    let status;
    try {
      let hasMore = true;
      while (hasMore) {
        const { data } = await plaid().transactionsSync({ access_token: accessToken, cursor, count: 500 });
        added = added.concat(data.added);
        cursor = data.next_cursor;
        hasMore = data.has_more;
        status = data.transactions_update_status;
      }
    } catch (e) {
      // Data changed mid-pagination: restart from the original cursor.
      if (e.response?.data?.error_code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION") continue;
      throw e;
    }

    if (status === "NOT_READY" && added.length === 0 && !startCursor) {
      await sleep(2000);
      continue;
    }

    const result = await importTransactions(userId, "plaid", added.map(toNormalized));
    await updatePlaidItemCursor(item._id, cursor);
    return result;
  }
  return { inserted: 0, skipped: 0, invalid: 0, embedded: 0, pending: true };
};

const sumResults = (results) =>
  results.reduce(
    (acc, r) => {
      for (const k of ["inserted", "skipped", "invalid", "embedded"]) acc[k] += r[k] ?? 0;
      if (r.embedError) acc.embedError = r.embedError;
      if (r.pending) acc.pending = true;
      return acc;
    },
    { inserted: 0, skipped: 0, invalid: 0, embedded: 0 }
  );

export const exchangePublicToken = async (userId, publicToken, institutionName) => {
  const { data } = await plaid().itemPublicTokenExchange({ public_token: publicToken });
  const item = await createPlaidItem({
    userId,
    itemId: data.item_id,
    accessTokenEnc: encrypt(data.access_token),
    institutionName,
  });
  return syncItem(userId, item);
};

export const syncAllItems = async (userId) => {
  const items = await findPlaidItemsByUser(userId);
  const results = [];
  for (const item of items) results.push(await syncItem(userId, item));
  return sumResults(results);
};

export const listItems = async (userId) =>
  (await findPlaidItemsByUser(userId)).map(({ _id, institutionName, createdAt }) => ({
    _id,
    institutionName,
    createdAt,
  }));

export const removeItems = async (userId) => {
  const items = await findPlaidItemsByUser(userId);
  for (const item of items) {
    try {
      await plaid().itemRemove({ access_token: decrypt(item.accessTokenEnc) });
    } catch (e) {
      console.error(`Plaid itemRemove failed for ${item.itemId}:`, e.response?.data ?? e.message);
    }
  }
  await deletePlaidItemsByUser(userId);
};
