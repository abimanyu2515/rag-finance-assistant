# RAG Finance Assistant — Project Summary

## Overview

**RAG Finance Assistant** is a full-stack personal finance web application powered by an AI chatbot. Users can view their financial dashboard, browse transactions, and chat with an AI assistant that answers questions based on their actual transaction data. The AI uses a full Retrieval-Augmented Generation (RAG) pipeline — transactions are embedded and stored in a Qdrant vector database, semantically retrieved per query, and injected as context into prompts sent to a local LLM (Mistral via Ollama).

---

## Architecture

```
┌─────────────────────────────┐       ┌────────────────────────────────┐
│        Frontend              │       │          Backend (Node.js)       │
│  Next.js 16 + TypeScript     │◄─────►│  Express 5 + MongoDB/Mongoose   │
│  Tailwind CSS + shadcn/ui    │       │                                  │
│  NextAuth (JWT sessions)     │       │  ┌──────────────────────────┐   │
└─────────────────────────────┘       │  │  Ollama (local LLM)       │   │
                                       │  │  Model: Mistral           │   │
                                       │  └──────────────────────────┘   │
                                       │                                  │
                                       │  ┌──────────────────────────┐   │
                                       │  │  Qdrant (vector DB)       │   │
                                       │  │  Embed: nomic-embed-text  │   │
                                       │  └──────────────────────────┘   │
                                       └────────────────────────────────┘
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
| Vector Database | Qdrant (local) |
| Embeddings | Ollama — nomic-embed-text (768-dim) |
| AI / LLM | Ollama running Mistral locally |
| HTTP Client | Axios (backend → Ollama) |
| Password Hashing | bcryptjs |
| Auth (Backend) | JSON Web Tokens (jsonwebtoken) |

---

## Project Structure

```
rag-finance-assistant/
├── backend-node/
│   ├── server.js                  # Entry point — Express app, routes registration
│   └── src/
│       ├── config/db.js           # MongoDB connection
│       ├── controllers/
│       │   ├── authController.js          # Register / Login
│       │   ├── chatController.js          # AI chat handler
│       │   └── conversationController.js  # CRUD for conversations
│       ├── middleware/            # JWT auth middleware
│       ├── models/
│       │   ├── User.js            # User schema (name, email, password)
│       │   ├── Transactions.js    # Transaction schema
│       │   └── Conversations.js   # Conversation + messages schema
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── chatRoutes.js
│       │   └── conversationRoutes.js
│       └── utils/
│           ├── aiService.js           # Builds prompt + calls Ollama
│           ├── embedService.js        # Embeds text via nomic-embed-text (Ollama)
│           ├── financialSummary.js    # Aggregates transactions → summary + merchants
│           ├── ingestTransactions.js  # Embeds & upserts a transaction into Qdrant
│           └── retrieveContext.js     # Semantic search in Qdrant filtered by userId
│
└── frontend/
    ├── app/
    │   ├── (auth)/               # Login / Register pages
    │   └── (root)/
    │       ├── layout.tsx         # Root layout with Sidebar
    │       ├── dashboard/         # Dashboard page
    │       ├── transactions/      # Transactions list page
    │       ├── ai-assistant/      # AI Chatbot page
    │       ├── fraud-detection/   # Fraud Detection page (stub)
    │       └── app-settings/      # Settings page (stub)
    ├── components/
    │   ├── Sidebar.tsx            # Collapsible nav sidebar with chat history
    │   ├── ChatHistory.tsx        # List of past AI conversations in sidebar
    │   ├── CustomHeader.tsx       # Page header bar
    │   ├── CustomStats.tsx        # KPI stat cards
    │   └── assistant/
    │       ├── MessageList.tsx    # Renders chat messages
    │       └── ChatInput.tsx      # Chat text input
    ├── contexts/
    │   └── SidebarContext.tsx     # Global sidebar collapsed/expanded state
    └── types/
        └── chat.ts                # TypeScript types for messages & conversations
```

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
- *(Currently renders from local constants — not yet wired to the live API.)*

### 4. AI Assistant (RAG Chatbot)
- User types a question; the frontend POSTs to `/api/chat` with the message and an optional `conversationId`.
- The backend runs a full **3-stage RAG pipeline**:
  1. **Embed** — the user's message is embedded via `nomic-embed-text` (Ollama).
  2. **Retrieve** — Qdrant is searched for the top-8 semantically relevant transactions belonging to the user (filtered by `userId`).
  3. **Generate** — a prompt is built with the retrieved transactions + a financial summary (total credit/debit, balance, per-category spending, all merchant names, suspicious count) and sent to **Ollama** (Mistral).
- The full conversation (user + assistant turns) is persisted to MongoDB.
- Returns the AI reply and the `conversationId` to the frontend.

### 5. Conversation History (Sidebar)
- The **Sidebar** fetches the user's past conversations from `/api/conversations?userId=...`.
- Clicking a history item fires a `ai-chat:select-conversation` custom event; the AI page loads that conversation.
- "New Chat" fires `ai-chat:new-conversation`, clearing the current session.
- Conversations can be deleted from the sidebar.
- The sidebar is collapsible — all pages respond to its expanded/collapsed state via `SidebarContext`.

### 6. Fraud Detection
- Page exists but is currently a stub with no implemented logic.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/chat` | Send a message to the AI (auth required) |
| GET | `/api/conversations` | Get all conversations for a user |
| GET | `/api/conversations/:id` | Get a single conversation by ID |
| POST | `/api/conversations` | Create a new conversation |
| DELETE | `/api/conversations/:id` | Delete a conversation |

---

## Data Models

### User
```
{ name, email, password, timestamps }
```

### Transaction
```
{ userId, amount, category, merchant, name, type (credit|debit), timestamp, isSuspicious }
```

### Conversation
```
{ userId, title, messages: [{ role, content, timestamp }] }
```

---

## How the RAG Pattern Works

```
User Message
     │
     ▼
embedText()  →  768-dim vector  (nomic-embed-text via Ollama)
     │
     ▼
Qdrant semantic search  →  top-8 transactions filtered by userId
     │
     ▼
Transaction.find({ userId })  →  buildFinancialSummary()
     │                            { totalCredit, totalDebit, balance,
     │                              categoryMap, merchants[], suspiciousCount }
     ▼
Construct Prompt  =  Retrieved Transactions + Financial Summary + User Question
     │
     ▼
POST to Ollama /api/generate  (model: mistral, stream: false)
     │
     ▼
Return AI response to user + save to Conversation history
```

---

## Environment Variables

**Backend (`backend-node/.env`)**
```
PORT=<port>
MONGO_URI=<mongodb connection string>
JWT_SECRET=<secret>
OLLAMA_URL=<ollama api url, e.g. http://localhost:11434/api/generate>
```

**Frontend (`frontend/.env`)**
```
NEXT_PUBLIC_BACKEND_URL=<backend base url>
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=<frontend url>
```

---

## Current Status

| Feature | Status |
|---|---|
| Auth (register/login) | ✅ Complete |
| JWT-protected API | ✅ Complete |
| Transaction ingestion into Qdrant | ✅ Complete |
| Semantic retrieval (Qdrant + userId filter) | ✅ Complete |
| AI Chatbot (full RAG pipeline) | ✅ Complete |
| Financial summary with merchants | ✅ Complete |
| Conversation History & Sidebar | ✅ Complete |
| Dashboard UI | ✅ (mock data) |
| Transactions UI | ✅ (mock data) |
| Dashboard/Transactions live data | 🔲 Not yet wired |
| Conversation history in AI prompt | 🔲 Not implemented (AI is stateless per message) |
| Fraud Detection | 🔲 Stub only |
| App Settings | 🔲 Stub only |