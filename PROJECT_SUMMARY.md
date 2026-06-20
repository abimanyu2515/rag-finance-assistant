# RAG Finance Assistant — Project Summary

## Overview

**RAG Finance Assistant** is a full-stack personal finance web application powered by an AI chatbot. Users can view their financial dashboard, browse transactions, and chat with an AI assistant that answers questions based on their actual transaction data. The AI uses a **hybrid retrieval pipeline** — an intent detection layer routes temporal queries (e.g., "last 5 transactions") directly to Supabase with date sorting, while semantic queries (e.g., "spending at Amazon") go through the full RAG pipeline: transactions are embedded and stored as `pgvector` columns directly on the transaction row in Postgres, semantically retrieved per query via a SQL RPC function, and injected as context into prompts sent to a local LLM (Qwen 2.5 7B via Ollama). Responses are **streamed token-by-token** to the frontend via Server-Sent Events (SSE).

All application state — users, transactions, conversations, messages, and vector embeddings — lives in a single **Supabase (Postgres + pgvector)** database. This replaced an earlier architecture that split storage across MongoDB (users/transactions/conversations) and Qdrant (vector search), eliminating the need to keep two databases in sync.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │               Frontend (Next.js 16 + React 19)                 │  │
│  │                                                                │  │
│  │   /dashboard        → KPI Cards, Charts (Recharts) — mock data│  │
│  │   /transactions     → Full Transaction Table — live API       │  │
│  │   /ai-assistant     → RAG Chatbot (SSE Streaming) — live API  │  │
│  │                                                                │  │
│  │   Auth: NextAuth v4 (JWT)    Styling: Tailwind + shadcn/ui    │  │
│  └──────────────────────────────┬─────────────────────────────────┘  │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │  HTTP / SSE
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Backend (Node.js + Express 5)                       │
│                                                                         │
│   POST /api/auth/signup            → Register user                     │
│   POST /api/auth/signin            → Login, returns JWT                │
│   POST /api/chat                   → AI chat (RAG pipeline + SSE)      │
│   GET  /api/conversations          → List conversations                │
│   GET  /api/conversations/:id      → Get conversation + messages       │
│   POST /api/conversations          → Create conversation               │
│   POST /api/conversations/:id/messages → Append a message              │
│   PATCH /api/conversations/:id/title   → Rename a conversation         │
│   DELETE /api/conversations/:id    → Delete conversation               │
│   GET  /api/transactions           → List user transactions            │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │              Hybrid Retrieval Pipeline                        │      │
│   │                                                              │      │
│   │   User Message                                               │      │
│   │        │                                                     │      │
│   │        ▼                                                     │      │
│   │   Intent Detection (intentDetector.js)                       │      │
│   │        │                                                     │      │
│   │        ├── Temporal? → Supabase (date-sorted, exact count)   │      │
│   │        │                                                     │      │
│   │        └── Semantic? → embedText() → 768-dim vector          │      │
│   │                            │                                 │      │
│   │                            ▼                                 │      │
│   │              match_transactions() RPC →  Top relevant txns   │      │
│   │              (pgvector cosine similarity, scoped to userId)  │      │
│   │                                                              │      │
│   │   Financial Summary (all transactions) ──┐                   │      │
│   │                                          ▼                   │      │
│   │              Build Prompt + Stream via Ollama (SSE)          │      │
│   └─────────────────────────────────────────────────────────────┘      │
└────────────┬────────────────────────────────────────┬───────────────────┘
             │                                         │
             ▼                                         ▼
      ┌─────────────────────────────┐         ┌────────────────┐
      │   Supabase (Postgres)        │         │    Ollama      │
      │                              │         │                │
      │ • Users                      │         │ • LLM:         │
      │ • Transactions (+ embedding) │         │   qwen2.5:7b   │
      │ • Conversations              │         │ • Embeddings:  │
      │ • Messages                   │         │   nomic-embed  │
      │ • pgvector HNSW index        │         │                │
      │ • match_transactions() RPC   │         │                │
      └─────────────────────────────┘         └────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI |
| Charts | Recharts |
| Auth (Frontend) | NextAuth v4 (JWT) |
| Backend | Node.js, Express 5 (ESM) |
| Database | Supabase (Postgres + pgvector), via `@supabase/supabase-js` (service role key) |
| Embeddings | Ollama — nomic-embed-text (768-dim) |
| AI / LLM | Ollama running Qwen 2.5 7B locally |
| Streaming | Server-Sent Events (SSE) for token-by-token responses |
| HTTP Client | Axios (backend → Ollama) |
| Password Hashing | bcryptjs |
| Auth (Backend) | JSON Web Tokens (jsonwebtoken) |

---

## Key Features

### 1. Authentication
- Users register and log in via `/api/auth`.
- Passwords are hashed with **bcryptjs**.
- Backend issues a **JWT**; frontend stores it via **NextAuth** and attaches it as a `Bearer` token on protected requests.
- User records live in Supabase's `users` table — auth logic (hashing, token issuance) is unchanged from the pre-migration implementation; only the storage layer changed.

### 2. Dashboard
- Displays KPI stat cards (total balance, spending, etc.).
- **Spending Trend** line chart (monthly data).
- **Category Distribution** pie chart (Groceries, Shopping, Dining, Bills, Transport).
- Recent transactions table.
- *(Currently uses mock/constant data — not yet wired to the live API.)*

### 3. Transactions
- Full transaction list with Merchant, Category, Amount, Date, and Status columns.
- Backend API (`GET /api/transactions`) fetches real data from Supabase, sorted by `timestamp` descending.
- **Live** — wired to the API and confirmed working end-to-end.

### 4. AI Assistant (Hybrid RAG Chatbot)
- User types a question; the frontend POSTs to `/api/chat` with the message and an optional `conversationId`.
- The backend runs a **hybrid retrieval pipeline**:

  **Intent Detection (first):**
  - `intentDetector.js` checks if the query is temporal (e.g., "last 5 transactions", "first 3 transactions").
  - If temporal → bypasses vector search entirely, queries Supabase directly with proper date sorting and exact count.

  **Semantic RAG Pipeline (for non-temporal queries):**
  1. **Embed** — the user's message is embedded via `nomic-embed-text` (Ollama) into a 768-dimensional vector.
  2. **Retrieve** — the `match_transactions` Postgres RPC function is called via `supabase.rpc(...)`, returning the top-8 semantically relevant transactions belonging to the user (filtered by `user_id`, minimum cosine similarity score 0.45), using a `pgvector` HNSW index for fast approximate nearest-neighbor search.
  3. **Generate** — a prompt is built with the retrieved transactions + a financial summary (total credit/debit, balance, per-category spending, all merchant names, suspicious count) and sent to **Ollama** (Qwen 2.5 7B).

  **Common to both paths:**
  - Financial summary is built from the user's last 100 transactions.
  - Conversation history (last 4 messages) is included in the prompt for context.
  - AI response is **streamed token-by-token** via SSE to the frontend.
  - The user's message and the assistant's reply are each persisted as a separate row in the `messages` table — not a whole-conversation rewrite — avoiding read-modify-write races on concurrent messages.

### 5. Conversation History (Sidebar)
- The **Sidebar** fetches the user's past conversations from `/api/conversations`, scoped to the authenticated user via JWT.
- Clicking a history item fires a `ai-chat:select-conversation` custom event; the AI page loads that conversation (and its messages, joined from the `messages` table).
- "New Chat" fires `ai-chat:new-conversation`, clearing the current session.
- Conversations can be renamed and deleted from the sidebar.
- The sidebar is collapsible — all pages respond to its expanded/collapsed state via `SidebarContext`.

---

## Data Models

Stored as relational Postgres tables (see `supabase/schema.sql` for the full DDL, indexes, and RLS policies).

### `users`
```
{ id (uuid, pk), name, email (unique), password (bcrypt hash), created_at, updated_at }
```

### `transactions`
```
{ id (uuid, pk), user_id (fk → users), amount, category, merchant, name,
  type (credit|debit), is_suspicious, timestamp, embedding (vector(768)), created_at }
```
- `embedding` is populated by the ingest script and used by the `match_transactions` RPC.
- An HNSW index on `embedding` (cosine ops) makes similarity search fast at scale.

### `conversations`
```
{ id (uuid, pk), user_id (fk → users), title, created_at, updated_at }
```
- `updated_at` is bumped automatically by a Postgres trigger whenever a new message is inserted — no manual update needed in application code.

### `messages`
```
{ id (uuid, pk), conversation_id (fk → conversations, on delete cascade),
  role (user|assistant), content, created_at }
```
- One row per message, rather than an embedded array — this was a deliberate choice over storing messages as a JSONB column, trading a touch more query complexity for relational query flexibility (e.g., easy "last message per conversation" previews) and avoiding unbounded-array growth on a single row.

---

## How the Hybrid RAG Pipeline Works

```
User Message
     │
     ▼
Intent Detection (intentDetector.js)
     │
     ├── Temporal query? (e.g., "last 5 transactions")
     │        │
     │        ▼
     │   Supabase: transactions.select().eq('user_id', id)
     │             .order('timestamp', { ascending: ±1 }).limit(N)
     │        │
     │        ▼
     │   Date-sorted transactions (exact count)
     │
     └── Semantic query? (e.g., "spending at Amazon")
              │
              ▼
         embedText()  →  768-dim vector  (nomic-embed-text via Ollama)
              │
              ▼
         supabase.rpc('match_transactions', {
           p_user_id, p_query_embedding, p_match_count: 8, p_min_score: 0.45
         })
              │
              ▼
         Relevance-ranked transactions (pgvector cosine similarity)
                    │
                    ▼  (both paths merge here)
     ┌──────────────────────────────────────────┐
     │  transactions.select().eq('user_id', id) │
     │         .order('timestamp', desc).limit(100) │
     │         ▼                                 │
     │  buildFinancialSummary()                  │
     │  { totalCredit, totalDebit, balance,      │
     │    categoryMap, merchants[],              │
     │    suspiciousCount, name }                │
     └──────────────────────────────────────────┘
                    │
                    ▼
     buildPrompt() = System Role + Conversation History
                   + Financial Context + Instructions + Question
                    │
                    ▼
     POST to Ollama /api/generate  (model: qwen2.5:7b, stream: true)
                    │
                    ▼
     Stream tokens via SSE → Frontend renders word-by-word
                    │
                    ▼
     Save user + assistant messages to Supabase (messages table,
     one INSERT per message — conversations.updated_at trigger fires automatically)
```

---

## Migration Notes (MongoDB + Qdrant → Supabase)

A few decisions worth recording for context on *why* the schema looks the way it does:

- **Single data store.** Consolidating to Supabase removed the need to keep a `mongoId` cross-reference between MongoDB documents and Qdrant vector points — embeddings now live as a column on the `transactions` row itself.
- **Relational `messages` table over JSONB array.** Conversations could have stored `messages` as a JSONB array (closer to the original Mongo subdocument shape), but a dedicated table was chosen for query flexibility and to avoid a single row growing unbounded.
- **Frontend required zero ID-format changes.** An audit of the frontend confirmed `_id` was only ever used as an opaque string (React keys, equality checks) — never parsed as a Mongo ObjectId — so switching to Postgres UUIDs needed no frontend changes. The backend's data-access layer (`models/*.js`) deliberately maps Postgres's snake_case columns back to the same camelCase, `_id`-keyed shape the frontend already expected.
- **Service role key, not anon key.** The backend authenticates requests with its own JWT, not Supabase Auth — so Postgres's `auth.uid()` is always `NULL` for these requests. The backend must use the Supabase **service role** key (which bypasses Row Level Security) rather than the anon key; RLS policies are scaffolded on the tables for a possible future move to Supabase Auth, but are currently inert by design.

---

## Environment Variables

**Backend (`backend-node/.env`)**
```env
PORT=5000
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
JWT_SECRET=your_jwt_secret_key_here
OLLAMA_URL=http://localhost:11434
BACKEND_URL=http://localhost:5000
```

**Frontend (`frontend/.env`)**
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_key_here
```