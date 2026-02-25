'use client';
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Receipt, Shield, MessageSquare, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';
import ChatHistory from './ChatHistory';
import { Conversation } from '@/types/chat';
import { useSession } from 'next-auth/react';

interface NavItem {
  name: string;
  icon: React.ReactNode;
  href: string;
}

const API_BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api`;

const Sidebar = () => {
  const {data: session} = useSession();
  const USER_ID = (session?.user as { _id?: string; id?: string } | undefined)?._id
    ?? (session?.user as { _id?: string; id?: string } | undefined)?.id;

  useEffect(() => {
    if (session?.user) {
      console.log('User details:', session.user);
      console.log('User ID:', USER_ID);
    }
  }, [session, USER_ID]);
  
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, href: '/dashboard' },
    { name: 'Transactions', icon: <Receipt size={20} />, href: '/transactions' },
    // { name: 'Fraud Detection', icon: <Shield size={20} />, href: '/fraud-detection' },
    { name: 'AI Assistant', icon: <MessageSquare size={20} />, href: '/ai-assistant' },
  ];

  const loadConversations = async () => {
    if (!USER_ID) return;

    setLoadingConversations(true);
    try {
      const response = await fetch(`${API_BASE_URL}/conversations?userId=${USER_ID}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!USER_ID) return;
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}?userId=${USER_ID}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID })
      });
      
      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c._id !== conversationId));
        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
          window.dispatchEvent(new CustomEvent('ai-chat:new-conversation'));
        }
        window.dispatchEvent(new CustomEvent('ai-chat:refresh-conversations'));
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  useEffect(() => {
    if (pathname === '/ai-assistant') {
      loadConversations();
    }
  }, [pathname, USER_ID]);

  useEffect(() => {
    const handleRefresh = () => {
      if (pathname === '/ai-assistant') {
        loadConversations();
      }
    };
    window.addEventListener('ai-chat:refresh-conversations', handleRefresh);
    return () => window.removeEventListener('ai-chat:refresh-conversations', handleRefresh);
  }, [pathname, USER_ID]);

  return (
    <div 
      className={`fixed left-0 top-0 h-screen bg-black border-r border-gray-500 transition-all duration-300 ease-in-out z-40 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-20 px-6 border-b">
        {!isCollapsed ? (
          <h1 className="text-2xl font-bold">QueryFi</h1>
        ) : 
        (
          <h1 className='text-xl font-bold text-title'>QF</h1>
        )}
      </div>

      {/* Collapse Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-24 bg-[#6366f1] text-white rounded-full p-1.5 shadow-lg hover:bg-[#5558e3] transition-colors cursor-pointer z-10"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Navigation */}
      <nav className="flex flex-col justify-between h-[calc(100vh-5rem)] mt-5 py-8">
        <div className="space-y-2 px-3">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 ${
                pathname === item.href
                  ? 'bg-[#6366f1] text-white'
                  : 'text-gray-400 hover:bg-[#2d3748] hover:text-white'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? item.name : ''}
            >
              <span className="flex shrink-0">{item.icon}</span>
              {!isCollapsed && (
                <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>
              )}
            </Link>
          ))}

          {!isCollapsed && pathname === '/ai-assistant' && (
            <ChatHistory
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={(conversationId) => {
                setCurrentConversationId(conversationId);
                window.dispatchEvent(new CustomEvent('ai-chat:select-conversation', { detail: { conversationId } }));
              }}
              onNewChat={() => {
                setCurrentConversationId(null);
                window.dispatchEvent(new CustomEvent('ai-chat:new-conversation'));
              }}
              onDeleteConversation={(conversationId) => {
                deleteConversation(conversationId);
              }}
              isLoading={loadingConversations}
            />
          )}
        </div>
      </nav>
    </div>
  );
};

export default Sidebar;
