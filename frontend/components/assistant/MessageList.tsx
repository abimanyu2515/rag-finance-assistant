'use client'

import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'

const SUGGESTIONS = [
  'How much did I spend on food this month?',
  'Show my last 5 transactions',
  'Do I have any suspicious transactions?',
  'Where does most of my money go?',
]

type Props = MessageListProps & {
  initial?: string
  onSuggestion?: (prompt: string) => void
}

const MessageList = ({ messages, isLoading = false, initial, onSuggestion }: Props) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  // The assistant bubble is added empty before the first token arrives; show the indicator instead of it
  const lastMessage = messages[messages.length - 1]
  const awaitingFirstToken = isLoading && lastMessage?.role === 'assistant' && !lastMessage.content
  const visibleMessages = awaitingFirstToken ? messages.slice(0, -1) : messages

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 min-h-full flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="size-12 rounded-full bg-peach flex items-center justify-center">
              <Sparkles className="size-6 text-black" />
            </span>
            <h2 className="text-2xl font-medium mt-5">How can I help with your money?</h2>
            <p className="text-sm text-ink-muted mt-2">Ask anything about your transactions, spending or balance.</p>

            {onSuggestion && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-xl">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => onSuggestion(s)}
                    disabled={isLoading}
                    className="text-left text-sm text-ink-2 bg-panel border border-line-soft hover:border-line-strong rounded-xl px-4 py-3 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {visibleMessages.map((message) => (
              <MessageBubble key={message.id} message={message} initial={initial} />
            ))}
            {awaitingFirstToken && <TypingIndicator />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

export default MessageList
