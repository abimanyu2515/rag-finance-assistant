'use client'

import { ChatHistoryProps } from '@/types/chat'
import { Plus, Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog'

const ChatHistory = ({ conversations, currentConversationId, onSelectConversation, onNewChat, onDeleteConversation, isLoading }: ChatHistoryProps) => {
  const confirm = useConfirm();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <button
        onClick={onNewChat}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        New Chat
      </button>

      <p className='px-3 mt-6 mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-subtle'>Recent chats</p>

      <div className='flex-1 overflow-y-auto custom-scrollbar'>
        {isLoading ? (
            <div className='flex items-center justify-center h-20'>
                <div className='animate-spin rounded-full h-5 w-5 border-2 border-brand border-t-transparent'></div>
            </div>
        ) : conversations.length === 0 ? (
            <p className='text-sm text-ink-subtle px-3'>No conversations yet.</p>
        ) : (
            <div className='space-y-1'>
                {conversations.map((conv) => (
                    <div
                      key={conv._id}
                      className={`relative group rounded-lg transition-colors ${
                        currentConversationId === conv._id
                          ? 'bg-control'
                          : 'hover:bg-control'
                      }`}
                    >
                        <button
                          onClick={() => onSelectConversation(conv._id)}
                          className='w-full text-left px-3 py-2 pr-9 cursor-pointer'
                        >
                            <p className='text-sm text-ink truncate font-medium'>
                                {conv.title || 'Untitled Conversation'}
                            </p>
                            {conv.lastMessage && (
                              <p className='text-xs text-ink-subtle truncate mt-0.5'>
                                  {conv.lastMessage}
                              </p>
                            )}
                        </button>

                        {/* Always visible on touch screens; revealed on hover/focus where hover exists */}
                        <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                const ok = await confirm({
                                  title: 'Delete this conversation?',
                                  description: `“${conv.title}” and all its messages will be permanently deleted.`,
                                  confirmLabel: 'Delete',
                                  destructive: true,
                                })
                                if (ok) onDeleteConversation(conv._id)
                              }}
                              className='absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-ink-subtle hover:text-neg hover:bg-neg/10 transition-[color,background-color,opacity] cursor-pointer [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100'
                              aria-label={`Delete conversation ${conv.title || ''}`.trim()}
                            >
                              <Trash2 className='w-3.5 h-3.5' />
                            </button>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  )
}

export default ChatHistory
