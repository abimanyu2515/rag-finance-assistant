'use client'

import { useState, KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'

const ChatInput = ({ onSendMessage, disabled = false }: ChatInputProps) => {
  const [input, setInput] = useState('')

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="px-6 pb-6 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2 items-end bg-panel border border-line focus-within:border-line-strong rounded-2xl p-2 pl-4 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about your finances..."
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-subtle py-2.5 resize-none outline-none disabled:opacity-50 disabled:cursor-not-allowed overflow-y-auto"
            style={{
              minHeight: '40px',
              maxHeight: '128px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className="bg-brand hover:bg-brand-hover disabled:bg-control disabled:text-ink-subtle disabled:cursor-not-allowed text-white rounded-xl p-2.5 transition-colors cursor-pointer"
            aria-label="Send message"
          >
            <ArrowUp className='size-5' />
          </button>
        </div>
        <p className="text-[11px] text-ink-subtle mt-2 text-center">Press Enter to send, Shift + Enter for new line</p>
      </div>
    </div>
  )
}

export default ChatInput
