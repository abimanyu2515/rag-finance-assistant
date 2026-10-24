'use client'

import { Sparkles } from 'lucide-react'

const TypingIndicator = () => {
  return (
    <div className="flex gap-3">
      <div className="flex shrink-0 size-8 rounded-full items-center justify-center bg-peach text-black">
        <Sparkles className="size-4" />
      </div>

      <div className="flex items-center bg-panel border border-line-soft rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1">
          <span className="size-1.5 bg-ink-subtle rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="size-1.5 bg-ink-subtle rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="size-1.5 bg-ink-subtle rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

export default TypingIndicator
