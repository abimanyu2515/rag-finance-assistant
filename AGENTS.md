# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, Cursor, and others) when working with code in this repository.

## Next.js version
This is Next.js 16.4 — APIs and conventions differ from older versions. Before writing Next.js code, read the relevant guide in node_modules/next/dist/docs/ (e.g. 01-app/02-guides/authentication-with-cache-components.md, 01-app/03-api-reference/). next dev rewrites the block in AGENTS.md; leave it in place.

## Project

Personal finance web app with a RAG chatbot over the user's own transactions. Two independent npm projects, no root workspace:

- `backend-node/` — Express 5 API (plain JS, ES modules)
- `frontend/` — Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui

External services: Supabase (hosted Postgres + pgvector), Ollama (local, embeddings only), Groq API (LLM).

## Commands

Backend (`cd backend-node`):
- `npm run dev` — start with nodemon (port from `PORT`, normally 5000)
- `node src/scripts/ingest.js` — embed every transaction via Ollama and write the vector to `transactions.embedding`. Imports through the app embed on insert; this script is only a backfill for rows inserted by hand or imported while Ollama was down. Un-embedded rows are invisible to semantic search.

Frontend (`cd frontend`):
- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` — ESLint (the only static check in the repo)

There is no test suite in either project. The closest thing is the chat eval: `node src/scripts/evalChat.js --email <user> [--modes rag,tools] [--only 1,4]` (in `backend-node`) runs `eval/questions.json` through both chat modes against a user with `young_professional` demo data and writes `eval/results.md` (ground truth comes from calling the tools directly).

Ollama must be running with `nomic-embed-text` pulled (`ollama pull nomic-embed-text`). The README still lists `qwen2.5:7b`, but the chat LLM has moved to Groq and that model is no longer used.

## Environment

`backend-node/.env`: `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `OLLAMA_URL`, `GROQ_API_KEY`. Optional chat: `GROQ_MODEL` (default `qwen/qwen3.8-27b`, must support tool calling), `CHAT_MODE` (`tools` default, `rag` = old baseline). Optional Plaid Sandbox: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (default `sandbox`), `PLAID_TOKEN_KEY` (64 hex chars, AES-256-GCM key for stored access tokens), `USD_TO_INR` (default 83). Without the Plaid vars, `/api/plaid/*` returns 503 and the frontend hides bank actions.
`frontend/.env`: `NEXT_PUBLIC_BACKEND_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`.

The backend must use the Supabase **service_role** key. Auth is the app's own JWT, not Supabase Auth, so `auth.uid()` is always NULL and RLS would silently return zero rows with the anon key. Because RLS is effectively bypassed, every query must filter by `user_id` explicitly.

## Database

Schema lives in `backend-node/src/supabase/schema.sql` (README says `supabase/schema.sql` at the root — that path is stale). It is applied manually in the Supabase SQL editor; there is no migration tooling. Key pieces:
- `transactions.embedding vector(768)` with an HNSW index
- `match_transactions(p_user_id, p_query_embedding, p_match_count, p_min_score)` RPC — cosine-similarity search scoped to a user
- `transaction_stats(p_user_id, p_from, p_to, p_group_by, p_type, p_category, p_merchant)` RPC — sums/counts grouped by `none|category|merchant|month` (IST months), used by the chat tools. Without it, tools-mode chat fails.
- `transactions.source` (`manual` | `demo` | `plaid`) + `external_id`, unique per `(user_id, source, external_id)` — this is what makes re-imports idempotent. The migration for existing DBs is commented at the bottom of `schema.sql`.
- `plaid_items` holds one row per linked bank: encrypted access token + `/transactions/sync` cursor.
- `messages` is a separate table; a trigger bumps `conversations.updated_at` on insert. Delete cascades from conversations to messages.

`src/models/*.js` map snake_case rows to a camelCase shape with `_id` (a holdover from the earlier MongoDB version). The frontend and the prompt builder depend on that shape (`_id`, `userId`, `isSuspicious`), so keep the mapping when adding queries. Note `retrieveContext.js` does its own mapping of RPC rows.

## Chat / RAG flow

`POST /api/chat` → `src/controllers/chatController.js`, response is an SSE stream:
1. Load or create the conversation; take the last 4 messages as history; persist the user message.
2. `services/chatAgent.js` `runChat()` (HTTP-free, also used by the eval script) runs the turn in one of two modes (`CHAT_MODE`):
   - `tools` (default): `utils/financeTools.js` exposes read-only tools to Groq (`totals_for_range`, `spend_by_category`, `top_merchants`, `monthly_totals`, `compare_periods`, `list_transactions`, `search_transactions`). Up to 3 streamed tool rounds, then the answer. `userId` is injected server side, never a tool argument. Tool dates are IST calendar days, `to` inclusive. Bad args return `{error}` to the model rather than throwing.
   - `rag`: the original baseline, kept for comparison: embed the question (Ollama) → `match_transactions` (top 8, min 0.45) + `utils/financialSummary.js` over the latest 100 rows, pasted into the prompt.
3. `utils/aiService.js` holds the Groq client, both prompts and `streamCompletion` (accumulates streamed tool-call deltas). Model: `GROQ_MODEL`, default `qwen/qwen3.8-27b`.
4. The assistant reply is saved as a new message row.

SSE event order the frontend (`app/(root)/ai-assistant/page.tsx`) relies on: `{conversationId}` → `{status}`* (tool progress label) → many `{token}` → `{done}` → `{saved}`; `{error}` on failure. Change both sides together.

Adding a tool: handler + schema + `TOOL_STATUS` label in `financeTools.js`; keep it read-only and filtered by `user_id`.

The embedding text format in `utils/ingestTransactions.js` determines retrieval quality; changing it requires re-running ingest for all rows.

## Transaction imports

All sources go through `services/importTransactions.js` → `importTransactions(userId, source, normalized[])`: validate → flag suspicious (only rows whose source didn't set `isSuspicious`: >4× category median in the batch, or > ₹2,00,000) → upsert with `ignoreDuplicates` → batch-embed the newly inserted rows (`embedTexts`, chunks of 64). Embedding failures don't roll back the insert; the result carries `embedError`. Add new sources as adapters that produce the normalized shape `{externalId, amount, type, category, merchant, name, timestamp, isSuspicious?}`.
- Demo: `services/demoData.js`, a seeded generator (personas `student` / `young_professional` / `family`). `POST /api/transactions/demo`, `DELETE /api/transactions?source=demo`.
- Plaid Sandbox: `services/plaid.js` + `routes/plaidRoutes.js`; frontend `components/transactions/AddDataMenu.tsx` uses `react-plaid-link`. Only `added` from `/transactions/sync` is applied (`modified` / `removed` are a TODO). USD amounts are multiplied by `USD_TO_INR`. Sandbox Link login: `user_transactions_dynamic`.
- `buildEmbeddingText` in `utils/ingestTransactions.js` is shared by the script and the pipeline — keep it the single source of the embedding format.

## Auth

- Backend: `/api/auth/signup` and `/api/auth/signin` issue a JWT; `middleware/authMiddleware.js` (`protect`) verifies `Authorization: Bearer <token>` and sets `req.user`.
- Frontend: NextAuth Credentials provider (`app/api/auth/[...nextauth]/route.ts`) calls the backend sign-in and stores the backend JWT as `session.accessToken`; user id is `session.user._id`. Pages call the backend directly with `fetch` + that bearer token.
- `frontend/proxy.ts` is the Next.js 16 middleware (renamed from `middleware.ts`) handling auth redirects; new protected routes must be added to its `matcher`.
- `/api/chat`, `/api/transactions` and `/api/plaid` use `protect`. `/api/conversations/*` does **not** — it trusts a `userId` from the query/body.

## Gotchas

- `frontend/lib/api.ts` hardcodes `localhost:5000` and expects JSON from the SSE chat endpoint; it is stale — pages don't use it.
- Currency: everything is INR (₹). Plaid USD amounts are converted on import via `USD_TO_INR`.
- `fraud-detection` and `app-settings` appear in the `proxy.ts` matcher and README but have no pages yet.
- `src/config/db.js` `connectDB()` (called in `server.js`) only logs, a leftover from the MongoDB version; the real Supabase client is `src/config/supabase.js`.

## Context files

- [frontend/AGENTS.md](frontend/AGENTS.md): frontend layout, shadcn/theme token conventions, shared data hook, INR formatters
