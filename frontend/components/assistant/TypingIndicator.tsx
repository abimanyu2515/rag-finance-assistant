'use client'

import { Sparkles } from 'lucide-react'

// `status` is the backend's progress label while it runs tools, e.g. "Checking spending by category…"
const TypingIndicator = ({ status }: { status?: string }) => {
  return (
    <div className="flex gap-3">
      <div className="flex shrink-0 size-8 rounded-full items-center justify-center bg-peach text-black">
        <Sparkles className="size-4" />
      </div>

      <div className="flex items-center gap-3 bg-panel border border-line-soft rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1">
          <span className="size-1.5 bg-ink-subtle rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="size-1.5 bg-ink-subtle rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="size-1.5 bg-ink-subtle rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        {status && <span className="text-sm text-ink-muted" aria-live="polite">{status}</span>}
      </div>
    </div>
  )
}

export default TypingIndicator
