# RAG Finance Assistant — Project Summary

## Overview

**RAG Finance Assistant** is a full-stack personal finance web application powered by an AI chatbot. Users can view their financial dashboard, browse transactions, and chat with an AI assistant that answers questions based on their actual transaction data. The AI uses a **hybrid retrieval pipeline** — an intent detection layer routes temporal queries (e.g., "last 5 transactions") directly to MongoDB with date sorting, while semantic queries (e.g., "spending at Amazon") go through the full RAG pipeline: transactions are embedded and stored in a Qdrant vector database, semantically retrieved per query, and injected as context into prompts sent to a local LLM (Qwen 2.5 7B via Ollama). Responses are **streamed token-by-token** to the frontend via Server-Sent Events (SSE).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │               Frontend (Next.js 16 + React 19)                 │  │
│  │                                                                │  │
│  │   /dashboard        → KPI Cards, Charts (Recharts)            │  │
│  │   /transactions     → Full Transaction Table                   │  │
│  │   /ai-assistant     → RAG Chatbot (SSE Streaming)             │  │
│  │                     │  │
│  │                                                                │  │
│  │   Auth: NextAuth v4 (JWT)    Styling: Tailwind + shadcn/ui    │  │
│  └──────────────────────────────┬─────────────────────────────────┘  │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │  HTTP / SSE
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Backend (Node.js + Express 5)                       │
│                                                                         │
│   POST /api/auth/register          → Register user                     │
│   POST /api/auth/login             → Login, returns JWT                │
│   POST /api/chat                   → AI chat (RAG pipeline + SSE)      │
│   GET  /api/conversations          → List conversations                │
│   GET  /api/conversations/:id      → Get conversation                  │
│   POST /api/conversations          → Create conversation               │
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
│   │        ├── Temporal? → MongoDB (date-sorted, exact count)    │      │
│   │        │                                                     │      │
│   │        └── Semantic? → embedText() → 768-dim vector          │      │
│   │                            │                                 │      │
│   │                            ▼                                 │      │
│   │                     Qdrant Search →   Top relevant txns      │      │
│   │                                                              │      │
│   │   Financial Summary (all transactions) ──┐                   │      │
│   │                                          ▼                   │      │
│   │              Build Prompt + Stream via Ollama (SSE)          │      │
│   └─────────────────────────────────────────────────────────────┘      │
└────────────┬──────────────────┬──────────────────┬──────────────────────┘
             │                  │                  │
             ▼                  ▼                  ▼
      ┌────────────┐    ┌────────────┐     ┌────────────────┐
      │  MongoDB    │    │   Qdrant   │     │    Ollama      │
      │             │    │            │     │                │
      │ • Users     │    │ • 768-dim  │     │ • LLM:        │
      │ • Txns      │    │   vectors  │     │   qwen2.5:7b  │
      │ • Convos    │    │ • Cosine   │     │ • Embeddings: │
      │             │    │   search   │     │   nomic-embed  │
      └────────────┘    └────────────┘     └────────────────┘
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
| Database | MongoDB via Mongoose |
| Vector Database | Qdrant (local, port 6333) |
| Embeddings | Ollama — nomic-embed-text (768-dim) |
| AI / LLM | Ollama running Qwen 2.5 7B locally |
| Streaming | Server-Sent Events (SSE) for token-by-token responses |
| HTTP Client | Axios (backend → Ollama) |
| Password Hashing | bcryptjs |
| Auth (Backend) | JSON Web Tokens (jsonwebtoken) |

---

---

## Key Features

### 1. Authentication
- Users register and log in via `/api/auth`.
- Passwords are hashed with **bcryptjs**.
- Backend issues a **JWT**; frontend stores it via **NextAuth** and attaches it as a `Bearer` token on protected requests.

### 2. Dashboard
- Displays KPI stat cards (total balance, spending, etc.).
- **Spending Trend** line chart (monthly data).
- **Category Distribution** pie chart (Groceries, Shopping, Dining, Bills, Transport).
- Recent transactions table.
- *(Currently uses mock/constant data — not yet wired to the live API.)*

### 3. Transactions
- Full transaction list with Merchant, Category, Amount, Date, and Status columns.
- Backend API (`GET /api/transactions`) fetches real data from MongoDB sorted by date.
- *(Frontend currently renders from local constants — not yet wired to the live API.)*

### 4. AI Assistant (Hybrid RAG Chatbot)
- User types a question; the frontend POSTs to `/api/chat` with the message and an optional `conversationId`.
- The backend runs a **hybrid retrieval pipeline**:

  **Intent Detection (first):**
  - `intentDetector.js` checks if the query is temporal (e.g., "last 5 transactions", "first 3 transactions").
  - If temporal → bypasses Qdrant entirely, queries MongoDB with proper date sorting and exact count.

  **Semantic RAG Pipeline (for non-temporal queries):**
  1. **Embed** — the user's message is embedded via `nomic-embed-text` (Ollama) into a 768-dimensional vector.
  2. **Retrieve** — Qdrant is searched for the top-8 semantically relevant transactions belonging to the user (filtered by `userId`, minimum score 0.45).
  3. **Generate** — a prompt is built with the retrieved transactions + a financial summary (total credit/debit, balance, per-category spending, all merchant names, suspicious count) and sent to **Ollama** (Qwen 2.5 7B).

  **Common to both paths:**
  - Financial summary is built from the user's last 100 transactions.
  - Conversation history (last 10 messages) is included in the prompt for context.
  - Greeting detection skips financial context injection for simple greetings.
  - AI response is **streamed token-by-token** via SSE to the frontend.
  - The full conversation (user + assistant turns) is persisted to MongoDB.

### 5. Conversation History (Sidebar)
- The **Sidebar** fetches the user's past conversations from `/api/conversations?userId=...`.
- Clicking a history item fires a `ai-chat:select-conversation` custom event; the AI page loads that conversation.
- "New Chat" fires `ai-chat:new-conversation`, clearing the current session.
- Conversations can be deleted from the sidebar.
- The sidebar is collapsible — all pages respond to its expanded/collapsed state via `SidebarContext`.
---


---

## Data Models

### User
```
{ name, email, password, timestamps }
```

### Transaction
```
{ userId (ref: User), amount, category, merchant, name, type (credit|debit), timestamp, isSuspicious }
```

### Conversation
```
{ userId (ref: User), title, messages: [{ role, content, timestamp }] }
```

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
     │   MongoDB: find({ userId }).sort({ timestamp: ±1 }).limit(N)
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
         Qdrant semantic search  →  top-8 transactions (score ≥ 0.45)
              │
              ▼
         Relevance-ranked transactions
                    │
                    ▼  (both paths merge here)
     ┌──────────────────────────────────────────┐
     │  Transaction.find({ userId }).limit(100)  │
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
     Save conversation to MongoDB
```

---

## Environment Variables

**Backend (`backend-node/.env`)**
```env
PORT=5000
MONGODB_URI="MongoDB_ATLAS_URI"
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


