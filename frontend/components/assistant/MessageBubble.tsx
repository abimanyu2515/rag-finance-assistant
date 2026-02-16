import { Message } from '@/types/chat'
import { Bot, CircleUserRound } from 'lucide-react';
import React from 'react'

const MessageBubble = ({ message }: { message: Message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${ isUser ? 'flex-row-reverse' : 'flex-row' }`}>
      <div className={`flex shrink-0 items-center justify-center w-8 h-8 rounded-full ${ isUser ? 'bg-blue-600' : 'bg-purple-600' }`}>
        { isUser ? (
          <CircleUserRound className='w-7 h-7 text-white' />
        ) : (
          <Bot className='w-7 h-7 text-white' />
        ) }
      </div>

      <div className={`flex flex-col max-w-[70%] ${ isUser ? 'items-end' : 'items-start' }`}>
        <div className={`rounded-lg px-4 py-2 border border-blue-600 text-white ${isUser ? 'bg-blue-600 rounded-tr-none' : 'bg-black rounded-tl-none'}`}>
          <p className='text-sm whitespace-pre-wrap'>{message.content}</p>
        </div>

        <span className='text-xs text-gray-400 mt-1 px-1'>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  )
}

export default MessageBubble