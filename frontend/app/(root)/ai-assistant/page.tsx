'use client'

import PageShell from '@/components/PageShell'
import { useEffect, useRef, useState } from 'react'
import { ConversationDetail, Message } from '@/types/chat'
import MessageList from '@/components/assistant/MessageList'
import ChatInput from '@/components/assistant/ChatInput'
import { useSession } from 'next-auth/react'

const API_BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api`

const Chatbot = () => {
  const { data: session } = useSession();
  const USER_ID = (session?.user as { _id?: string; id?: string } | undefined)?._id
    ?? (session?.user as { _id?: string; id?: string } | undefined)?.id;
  const ACCESS_TOKEN = (session as { accessToken?: string } | undefined)?.accessToken;
  const initial = session?.user?.name

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const loadConversation = async (conversationId: string) => {
    if (!USER_ID) return;
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}?userId=${USER_ID}`);
      if (!response.ok) return;

      const conversation: ConversationDetail = await response.json();
      const loadedMessages = conversation.messages.map((message, index) => ({
        id: `${conversation._id}-${index}`,
        role: message.role,
        content: message.content,
        created_at: new Date(message.created_at)
      }));

      setMessages(loadedMessages);
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  }

  const handleSend = async (userMessage: Message) => {
    if (!USER_ID || !ACCESS_TOKEN) return;
    setLoading(true)

    const aiMessageId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        created_at: new Date()
      },
    ])
    
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          message: userMessage.content,
          userId: USER_ID,
          conversationId: currentConversationId
        })
      })

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, {stream: true})
        const lines = text.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          const json = line.replace('data: ', "").trim();

          try {
            const parsed = JSON.parse(json);
            
            if (parsed.conversationId) {
              setCurrentConversationId(parsed.conversationId);
            }
            if (parsed.token) {
              setMessages(prev => prev.map(msg => msg.id === aiMessageId ? 
                {...msg, content: msg.content + parsed.token} : msg
              ))
            }

            if (parsed.saved) {
              window.dispatchEvent(new CustomEvent("ai-chat:refresh-conversations"))
            }

            if (parsed.error) {
              setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId ? 
                    {...msg, content: `[Error]: ${parsed.error}`} : msg
              ))
            }
          } catch (e) {
            console.error('Error parsing message chunk:', e)
          }
        }
      }

    } catch (e) {
      console.error('Error sending message:', e)
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId ? 
            {...msg, content: "[Error generating response]"} : msg
      ))
    } finally {
      setLoading(false)
    }
  }

  const messageEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages])

  useEffect(() => {
    const handleSelectConversation = (event: Event) => {
      const customEvent = event as CustomEvent<{ conversationId: string }>;
      const conversationId = customEvent.detail?.conversationId;
      if (conversationId) {
        loadConversation(conversationId);
      }
    };

    const handleNewConversation = () => {
      setCurrentConversationId(null);
      setMessages([]);
    };

    window.addEventListener('ai-chat:select-conversation', handleSelectConversation as EventListener);
    window.addEventListener('ai-chat:new-conversation', handleNewConversation);

    return () => {
      window.removeEventListener('ai-chat:select-conversation', handleSelectConversation as EventListener);
      window.removeEventListener('ai-chat:new-conversation', handleNewConversation);
    };
  }, [USER_ID]);

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      created_at: new Date()
    }
    setMessages(prev => [...prev, newMessage])
    handleSend(newMessage)
  }

  return (
    <PageShell title='AI Assistant' fixed>
      <MessageList
        messages={messages}
        isLoading={loading}
        initial={initial ?? undefined}
        onSuggestion={handleSendMessage}
      />
      <ChatInput onSendMessage={handleSendMessage} disabled={loading} />
    </PageShell>
  )
}

export default Chatbot
