import { Message } from '@/types/chat'
import { Sparkles } from 'lucide-react';
import MarkdownContent from './MarkdownContent';

const MessageBubble = ({ message, initial }: { message: Message; initial?: string }) => {
  const isUser = message.role === 'user';
  const isError = !isUser && message.content.startsWith('[Error');

  return (
    <div className={`flex gap-3 ${ isUser ? 'flex-row-reverse' : 'flex-row' }`}>
      <div className={`flex shrink-0 items-center justify-center size-8 rounded-full text-sm font-semibold ${
        isUser ? 'bg-brand text-white' : 'bg-peach text-black'
      }`}>
        { isUser ? (initial?.charAt(0).toUpperCase() || 'U') : <Sparkles className='size-4' /> }
      </div>

      <div className={`flex flex-col max-w-[75%] ${ isUser ? 'items-end' : 'items-start' }`}>
        <div className={`max-w-full min-w-0 rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-brand text-white rounded-tr-sm'
            : `bg-panel border rounded-tl-sm ${isError ? 'border-neg/30 text-neg' : 'border-line-soft text-ink-2'}`
        }`}>
          {isUser || isError
            ? <p className='text-sm leading-relaxed whitespace-pre-wrap'>{message.content}</p>
            : <MarkdownContent content={message.content} />}
        </div>

        <span className='text-[11px] text-ink-subtle mt-1.5 px-1'>
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  )
}

export default MessageBubble
