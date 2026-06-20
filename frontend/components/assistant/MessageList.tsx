'use client'

import { useEffect, useRef } from 'react'
import { Message } from '@/types/chat'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'

const MessageList = ({ messages, isLoading = false, initial }: MessageListProps & { initial?: string }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-400 custom-scrollbar scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">Welcome to AI Assistant</p>
            <p className="text-sm">Start a conversation by typing a message below</p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} initial={initial} />
          ))}
          {isLoading && <TypingIndicator />}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}

export default MessageList
