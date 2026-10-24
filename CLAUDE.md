# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- `node src/scripts/ingest.js` — embed every transaction via Ollama and write the vector to `transactions.embedding`. Re-run after inserting new transactions; un-embedded rows are invisible to semantic search.

Frontend (`cd frontend`):
- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` — ESLint (the only static check in the repo)

There is no test suite in either project.

Ollama must be running with `nomic-embed-text` pulled (`ollama pull nomic-embed-text`). The README still lists `qwen2.5:7b`, but the chat LLM has moved to Groq and that model is no longer used.

## Environment

`backend-node/.env`: `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `OLLAMA_URL`, `GROQ_API_KEY`.
`frontend/.env`: `NEXT_PUBLIC_BACKEND_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`.

The backend must use the Supabase **service_role** key. Auth is the app's own JWT, not Supabase Auth, so `auth.uid()` is always NULL and RLS would silently return zero rows with the anon key. Because RLS is effectively bypassed, every query must filter by `user_id` explicitly.

## Database

Schema lives in `backend-node/src/supabase/schema.sql` (README says `supabase/schema.sql` at the root — that path is stale). It is applied manually in the Supabase SQL editor; there is no migration tooling. Key pieces:
- `transactions.embedding vector(768)` with an HNSW index
- `match_transactions(p_user_id, p_query_embedding, p_match_count, p_min_score)` RPC — cosine-similarity search scoped to a user
- `messages` is a separate table; a trigger bumps `conversations.updated_at` on insert. Delete cascades from conversations to messages.

`src/models/*.js` map snake_case rows to a camelCase shape with `_id` (a holdover from the earlier MongoDB version). The frontend and the prompt builder depend on that shape (`_id`, `userId`, `isSuspicious`), so keep the mapping when adding queries. Note `retrieveContext.js` does its own mapping of RPC rows.

## Chat / RAG flow

`POST /api/chat` → `src/controllers/chatController.js`, response is an SSE stream:
1. Load or create the conversation; take the last 4 messages as history; persist the user message.
2. `utils/intentDetector.js` regex-detects "last/first N transactions". If matched, skip vectors and do a timestamp-ordered query (capped at 50).
3. Otherwise embed the question (`utils/embedService.js` → Ollama `/api/embed`) and call `match_transactions` (top 8, min score 0.45) via `utils/retrieveContext.js`.
4. In both paths `utils/financialSummary.js` aggregates the latest 100 transactions (totals, balance, category map, merchants, suspicious count).
5. `utils/aiService.js` builds the system prompt and streams from Groq (`openai/gpt-oss-120b`).
6. The assistant reply is saved as a new message row.

SSE event order the frontend (`app/(root)/ai-assistant/page.tsx`) relies on: `{conversationId}` → many `{token}` → `{done}` → `{saved}`; `{error}` on failure. Change both sides together.

The embedding text format in `utils/ingestTransactions.js` determines retrieval quality; changing it requires re-running ingest for all rows.

## Auth

- Backend: `/api/auth/signup` and `/api/auth/signin` issue a JWT; `middleware/authMiddleware.js` (`protect`) verifies `Authorization: Bearer <token>` and sets `req.user`.
- Frontend: NextAuth Credentials provider (`app/api/auth/[...nextauth]/route.ts`) calls the backend sign-in and stores the backend JWT as `session.accessToken`; user id is `session.user._id`. Pages call the backend directly with `fetch` + that bearer token.
- `frontend/proxy.ts` is the Next.js 16 middleware (renamed from `middleware.ts`) handling auth redirects; new protected routes must be added to its `matcher`.
- `/api/chat` and `/api/transactions` use `protect`. `/api/conversations/*` does **not** — it trusts a `userId` from the query/body.

## Gotchas

- `frontend/lib/api.ts` hardcodes `localhost:5000` and expects JSON from the SSE chat endpoint; it is stale — pages don't use it.
- Currency: summary/prompt and dashboard format as INR, but the per-transaction lines in `aiService.js` use `$`.
- `fraud-detection` and `app-settings` appear in the `proxy.ts` matcher and README but have no pages yet.
