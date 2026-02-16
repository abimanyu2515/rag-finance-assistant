'use client'

import { Bot } from 'lucide-react'

const TypingIndicator = () => {
  return (
    <div className="flex gap-3">
      <div className="flex shrink-0 w-8 h-8 rounded-full items-center justify-center bg-purple-600">
        <Bot className="w-5 h-5 text-white" />
      </div>

      <div className="flex items-center bg-[#1a2942] rounded-lg rounded-tl-none px-4 py-3 border border-gray-700">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

export default TypingIndicator
