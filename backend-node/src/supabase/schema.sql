-- ============================================================================
-- QueryFi — Supabase (Postgres) Schema
-- Replaces: MongoDB (users, transactions, conversations) + Qdrant (vectors)
-- ============================================================================

-- 1. Extensions ---------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";     -- pgvector for embeddings


-- 2. Users ---------------------------------------------------------------------
-- NOTE: We are NOT using Supabase Auth here — keeping your existing
-- bcrypt + jsonwebtoken flow so the auth controller logic barely changes.
-- If you later want Supabase Auth, this table would instead extend
-- auth.users — that's a separate, optional migration.
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  password    text not null,              -- bcrypt hash
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_users_email on public.users (email);


-- 3. Transactions ----------------------------------------------------------------
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  amount        numeric(14, 2) not null,
  category      text,
  merchant      text,
  name          text,
  type          text not null check (type in ('credit', 'debit')),
  is_suspicious boolean not null default false,
  timestamp     timestamptz not null default now(),

  -- Embedding lives directly on the row — no more separate vector DB,
  -- no more mongoId <-> Qdrant point-id cross-referencing.
  embedding     vector(768),

  created_at    timestamptz not null default now()
);

create index if not exists idx_transactions_user_id on public.transactions (user_id);
create index if not exists idx_transactions_user_timestamp on public.transactions (user_id, "timestamp" desc);

-- ANN index for cosine similarity search (HNSW — good recall/speed tradeoff).
-- Build this AFTER you've ingested a meaningful number of rows for best results;
-- it still works fine on an empty/small table, just less optimized.
create index if not exists idx_transactions_embedding
  on public.transactions
  using hnsw (embedding vector_cosine_ops);


-- 4. Conversations -----------------------------------------------------------
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null default 'New Chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_conversations_user_updated
  on public.conversations (user_id, updated_at desc);


-- 5. Messages (split out of the old embedded array) --------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_messages_conversation_id
  on public.messages (conversation_id, "timestamp" asc);


-- 6. Keep conversations.updated_at fresh whenever a message is added ----------
create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_conversation on public.messages;
create trigger trg_touch_conversation
after insert on public.messages
for each row
execute function public.touch_conversation_updated_at();


-- 7. Vector similarity search RPC ---------------------------------------------
-- Mirrors retrieveContext.js: top-K cosine-similarity search scoped to a user,
-- with a minimum-score floor (0.45, same as the Qdrant MIN_SCORE).
-- Cosine DISTANCE (<=>) ranges 0..2; we convert to a similarity score (1 - distance/2... )
-- but to stay numerically identical to Qdrant's cosine "score" (which is
-- 1 - cosine_distance, range -1..1, practically 0..1 for normalized embeddings),
-- we compute similarity = 1 - (embedding <=> query_embedding).
create or replace function public.match_transactions(
  p_user_id        uuid,
  p_query_embedding vector(768),
  p_match_count    int default 8,
  p_min_score      float default 0.45
)
returns table (
  id            uuid,
  user_id       uuid,
  amount        numeric,
  category      text,
  merchant      text,
  name          text,
  type          text,
  is_suspicious boolean,
  "timestamp"   timestamptz,
  similarity    float
)
language sql
stable
as $$
  select
    t.id,
    t.user_id,
    t.amount,
    t.category,
    t.merchant,
    t.name,
    t.type,
    t.is_suspicious,
    t."timestamp",
    1 - (t.embedding <=> p_query_embedding) as similarity
  from public.transactions t
  where t.user_id = p_user_id
    and t.embedding is not null
    and 1 - (t.embedding <=> p_query_embedding) >= p_min_score
  order by t.embedding <=> p_query_embedding
  limit p_match_count;
$$;


-- 8. Row Level Security --------------------------------------------------------
-- Since the backend uses the Supabase service-role key (server-side, trusted),
-- RLS is a defense-in-depth layer, not the primary access control — the
-- Express JWT middleware (authMiddleware.js) remains the primary gate.
-- These policies matter most if you ever call Supabase directly from the
-- frontend with a user-scoped (anon/authenticated) key.

alter table public.users enable row level security;
alter table public.transactions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Service role bypasses RLS by default in Supabase, so no explicit policy
-- is required for the backend to function. The policies below are useful
-- ONLY if you adopt Supabase Auth later and call Postgres from the client
-- with auth.uid(). They are harmless no-ops otherwise (service role ignores them).

create policy "Users can view their own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can view their own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users can view their own messages"
  on public.messages for select
  using (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );