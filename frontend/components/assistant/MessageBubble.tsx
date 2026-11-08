import { Message } from '@/types/chat'
import { Loader2, Sparkles, Square, Volume2 } from 'lucide-react';
import MarkdownContent from './MarkdownContent';

export type SpeakState = 'loading' | 'playing'

type Props = {
  message: Message
  initial?: string
  /** Read-aloud: undefined hides the button (voice disabled or still streaming) */
  onSpeak?: (message: Message) => void
  speakState?: SpeakState
}

const MessageBubble = ({ message, initial, onSpeak, speakState }: Props) => {
  const isUser = message.role === 'user';
  const isError = !isUser && message.content.startsWith('[Error');
  const canSpeak = !isUser && !isError && !!onSpeak && message.content.trim() !== '';

  return (
    <div className={`flex gap-3 ${ isUser ? 'flex-row-reverse' : 'flex-row' }`}>
      <div className={`flex shrink-0 items-center justify-center size-8 rounded-full text-sm font-semibold ${
        isUser ? 'bg-brand text-white' : 'bg-peach text-black'
      }`}>
        { isUser ? (initial?.charAt(0).toUpperCase() || 'U') : <Sparkles className='size-4' /> }
      </div>

      <div className={`flex flex-col min-w-0 max-w-[85%] sm:max-w-[75%] ${ isUser ? 'items-end' : 'items-start' }`}>
        <div className={`max-w-full min-w-0 rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-brand text-white rounded-tr-sm'
            : `bg-panel border rounded-tl-sm ${isError ? 'border-neg/30 text-neg' : 'border-line-soft text-ink-2'}`
        }`}>
          {isUser || isError
            ? <p className='text-sm leading-relaxed whitespace-pre-wrap'>{message.content}</p>
            : <MarkdownContent content={message.content} />}
        </div>

        <div className='flex items-center gap-1 mt-1 px-1'>
          <span className='text-[11px] text-ink-subtle'>
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {canSpeak && (
            <button
              onClick={() => onSpeak(message)}
              className={`p-1 rounded-md transition-colors cursor-pointer hover:bg-control ${speakState ? 'text-brand' : 'text-ink-subtle hover:text-ink'}`}
              aria-label={speakState === 'playing' ? 'Stop reading aloud' : 'Read aloud'}
              title={speakState === 'playing' ? 'Stop' : 'Read aloud'}
            >
              {speakState === 'loading'
                ? <Loader2 className='size-3.5 animate-spin' />
                : speakState === 'playing' ? <Square className='size-3.5' /> : <Volume2 className='size-3.5' />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default MessageBubble
