'use client'

import CustomHeader from '@/components/CustomHeader'
import { useSidebar } from '@/contexts/SidebarContext'
import { useEffect, useRef, useState } from 'react'
import { Message } from '@/types/chat'
import MessageList from '@/components/assistant/MessageList'
import ChatInput from '@/components/assistant/ChatInput'

const Chatbot = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const { isCollapsed } = useSidebar();

  const handleSend = async () => {
    setLoading(true)
    
    try {
      const lastMessage = messages[messages.length - 1]
      
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: lastMessage.content,
          userId: 'user123' // TODO: Replace with actual user ID from auth
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const data = await response.json()
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, aiMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
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

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
    handleSend()
  }

  return (
    <>
      <div className={`fixed top-0 right-0 h-20 flex items-center bg-[#11213d] border-b z-30 transition-all duration-300 ${
        isCollapsed ? 'left-20' : 'left-64'
      }`}>
        <CustomHeader title='AI ASSISTANT' />
      </div>

      <div className={`fixed top-20 bottom-0 right-0 flex flex-col bg-[#0f1c33] transition-all duration-300 ${
        isCollapsed ? 'left-20' : 'left-64'
      }`}>
        <MessageList messages={messages} isLoading={loading} />
        <ChatInput onSendMessage={handleSendMessage} disabled={loading} />
      </div>
      
    </>
  )
}

export default Chatbot