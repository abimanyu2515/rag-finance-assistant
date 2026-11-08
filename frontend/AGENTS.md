# Frontend

## Overview

Next.js 16 App Router client for the finance app: sign in, dashboard, transactions list, and the AI assistant chat. Every data page is a client component that calls the Express backend directly with the NextAuth session's bearer token (see root `## Auth`).

## Key files

| File | Owns |
|---|---|
| `app/(auth)/` | Sign in and sign up pages (public routes) |
| `app/(root)/layout.tsx` | Signed in shell: `SidebarProvider` + `Sidebar` around every protected page |
| `components/PageShell.tsx` | Page frame (fixed header, sidebar offset). Wrap every `(root)` page in it; `fixed` fills the viewport (used by the chat) |
| `components/Sidebar.tsx` | Nav items (defined inline here, not in `constants/`) |
| `lib/useTransactions.ts` | Shared hook: fetches `/api/transactions` (latest 100, newest first) with `refetch`; used by dashboard and transactions pages |
| `lib/dashboard.ts` | INR formatters (`fmt`, `fmtCompact`), date formatters, range filtering (`applyRange`) |
| `app/(root)/ai-assistant/page.tsx` | SSE chat consumer (event order contract in root `## Chat / RAG flow`); shows `{status}` tool labels in `TypingIndicator` until the first token |
| `components/transactions/AddDataMenu.tsx` | Demo data and Plaid Link actions |
| `lib/voice.ts`, `lib/useRecorder.ts` | Voice chat: language picker store, `/api/voice/*` calls, and the MediaRecorder hook (30 s cap) used by `ChatInput`; read-aloud playback lives in the ai-assistant page |
| `app/globals.css` | Tailwind v4 `@theme` tokens and the light/dark palette |

## Conventions

- Import with the `@/` alias (maps to the `frontend/` root).
- shadcn/ui (`new-york`, zinc, lucide icons) lives in `components/ui/`; add primitives with `npx shadcn add <name>`, don't hand edit them. Feature components go in a folder per feature (`components/dashboard/`, `components/assistant/`, `components/transactions/`).
- Style with the app palette tokens (`bg-surface`, `bg-chrome`, `border-line`, `text-ink`, `text-ink-muted`, `bg-brand`, ...) instead of raw colors. They switch with the `.dark` class on `<html>` (toggled by `ThemeToggle`, no `next-themes`), so `dark:` variants are rarely needed.
- Format money with `fmt` / `fmtCompact` from `lib/dashboard.ts` (INR, `en-IN` grouping).
- Toasts use `sonner` (`toast(...)`); the `Toaster` is mounted in `app/Provider.tsx`.
- Shared app types live in `types/` (`transaction.ts`, `chat.ts`); `types/global.d.ts` declares a few ambient types (`NavItem`, `FormInputProps`).

## Gotchas

- A new protected page needs both a `PageShell` wrapper and an entry in the `proxy.ts` `matcher`, or it renders unprotected.
- `constants/index.ts` `stats` holds hardcoded sample values, not live data.
- `next dev` writes a managed Next.js block (between `<!-- BEGIN:nextjs-agent-rules -->` markers) into this file when it detects an AI agent. Leave it in place and commit it.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
