export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: Date;
    /** Reply language the user spoke in (e.g. "ta-IN"); picks the voice for read-aloud */
    language?: string;
}

export interface Conversation {
    _id: string;
    title: string;
    updatedAt: Date;
    lastMessage?: string;
}

export interface ConversationDetail {
    _id: string;
    userId: string;
    title: string;
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ChatInputsProps {
    onSendMessage: (content: string) => void;
    disabled?: boolean;
}

export interface ChatHistoryProps {
  conversations: Conversation[]
  currentConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewChat: () => void
  onDeleteConversation: (id: string) => void
  isLoading?: boolean
}