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
      className={`fixed left-0 top-0 h-screen flex flex-col bg-chrome border-r border-line transition-all duration-300 ease-in-out z-40 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 h-20 shrink-0 border-b border-line ${isCollapsed ? 'justify-center' : 'px-6'}`}>
        <span className='size-9 shrink-0 rounded-xl bg-brand text-white flex items-center justify-center text-sm font-bold'>
          QF
        </span>
        {!isCollapsed && <h1 className="text-xl font-semibold">QueryFi</h1>}
      </div>

      {/* Collapse Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-24 size-6 flex items-center justify-center bg-panel border border-line text-ink-muted hover:text-ink hover:border-line-strong rounded-full shadow-sm transition-colors cursor-pointer z-10"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Navigation */}
      <nav className="flex flex-col flex-1 min-h-0 pt-8 pb-6">
        {!isCollapsed && (
          <p className='px-6 mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-subtle'>Menu</p>
        )}
        <div className="space-y-1 px-3">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-control text-ink'
                    : 'text-ink-muted hover:bg-control hover:text-ink'
                } ${isCollapsed ? 'justify-center' : ''}`}
                title={isCollapsed ? item.name : ''}
              >
                {active && <span className='absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand' />}
                <span className={`flex shrink-0 ${active ? 'text-brand' : ''}`}>{item.icon}</span>
                {!isCollapsed && (
                  <span className="whitespace-nowrap">{item.name}</span>
                )}
              </Link>
            );
          })}
        </div>

        {!isCollapsed && pathname === '/ai-assistant' && (
          <div className='flex flex-col flex-1 min-h-0 mt-6 px-3'>
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
          </div>
        )}
      </nav>
    </div>
  );
};

export default Sidebar;
