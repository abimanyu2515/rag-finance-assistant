'use client';
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Receipt, MessageSquare, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';
import ChatHistory from './ChatHistory';
import { Conversation } from '@/types/chat';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

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

  const { isCollapsed, setIsCollapsed, isDrawerOpen, setIsDrawerOpen } = useSidebar();
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
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast.error('Couldn’t load your conversations', { description: 'Check that the backend is running, then reopen the assistant.' });
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

      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      setConversations((prev) => prev.filter((c) => c._id !== conversationId));
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        window.dispatchEvent(new CustomEvent('ai-chat:new-conversation'));
      }
      window.dispatchEvent(new CustomEvent('ai-chat:refresh-conversations'));
      toast.success('Conversation deleted');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Couldn’t delete the conversation', { description: 'Please try again.' });
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

  // Visibility helpers (literal class strings so Tailwind can see them).
  // Labels show below lg only while the drawer is open; at lg they follow isCollapsed.
  const showBlock = `${isDrawerOpen ? 'block' : 'hidden'} ${isCollapsed ? 'lg:hidden' : 'lg:block'}`;
  const showFlex = `${isDrawerOpen ? 'flex' : 'hidden'} ${isCollapsed ? 'lg:hidden' : 'lg:flex'}`;
  const showWhenRail = `${isDrawerOpen ? 'hidden' : 'block'} ${isCollapsed ? 'lg:block' : 'lg:hidden'}`;
  const centerWhenRail = `${isDrawerOpen ? '' : 'md:justify-center'} ${isCollapsed ? 'lg:justify-center' : 'lg:justify-start'}`;

  const closeDrawer = () => setIsDrawerOpen(false);

  const toggle = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) setIsCollapsed(!isCollapsed);
    else setIsDrawerOpen(!isDrawerOpen);
  };

  return (
    <>
      {/* Backdrop behind the drawer on phones/tablets */}
      {isDrawerOpen && (
        <div className='fixed inset-0 z-35 bg-black/50 lg:hidden' onClick={closeDrawer} aria-hidden='true' />
      )}

      <aside
        className={`fixed left-0 top-0 h-dvh flex flex-col bg-chrome border-r border-line transition-[width,transform,visibility] duration-300 ease-in-out z-40
          ${isDrawerOpen ? 'w-64 translate-x-0 shadow-2xl lg:shadow-none' : 'w-64 md:w-20 -translate-x-full invisible md:translate-x-0 md:visible'}
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'} lg:translate-x-0 lg:visible`}
        aria-label='Main navigation'
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 h-16 md:h-20 shrink-0 border-b border-line px-6 ${
          isDrawerOpen ? '' : 'md:px-0 md:justify-center'
        } ${isCollapsed ? 'lg:px-0 lg:justify-center' : 'lg:px-6 lg:justify-start'}`}>
          <span className='size-9 shrink-0 rounded-xl bg-brand text-white flex items-center justify-center text-sm font-bold'>
            QF
          </span>
          <h1 className={`text-xl font-semibold ${showBlock}`}>QueryFi</h1>
          {isDrawerOpen && (
            <button
              onClick={closeDrawer}
              className='ml-auto md:hidden size-9 flex items-center justify-center rounded-lg text-ink-muted hover:bg-control hover:text-ink cursor-pointer'
              aria-label='Close menu'
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Collapse / expand (tablet and desktop) */}
        <button
          onClick={toggle}
          className="hidden md:flex absolute -right-3 top-24 size-6 items-center justify-center bg-panel border border-line text-ink-muted hover:text-ink hover:border-line-strong rounded-full shadow-sm transition-colors cursor-pointer z-10"
          aria-label='Toggle sidebar'
        >
          <ChevronLeft size={14} className={showBlock} />
          <ChevronRight size={14} className={showWhenRail} />
        </button>

        {/* Navigation */}
        <nav className="flex flex-col flex-1 min-h-0 pt-6 md:pt-8 pb-6">
          <p className={`px-6 mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-subtle ${showBlock}`}>Menu</p>
          <div className="space-y-1 px-3">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={closeDrawer}
                  className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-control text-ink'
                      : 'text-ink-muted hover:bg-control hover:text-ink'
                  } ${centerWhenRail}`}
                  title={item.name}
                  aria-label={item.name}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && <span className='absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand' />}
                  <span className={`flex shrink-0 ${active ? 'text-brand' : ''}`}>{item.icon}</span>
                  <span className={`whitespace-nowrap ${showBlock}`}>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {pathname === '/ai-assistant' && (
            <div className={`${showFlex} flex-col flex-1 min-h-0 mt-6 px-3`}>
              <ChatHistory
                conversations={conversations}
                currentConversationId={currentConversationId}
                onSelectConversation={(conversationId) => {
                  setCurrentConversationId(conversationId);
                  closeDrawer();
                  window.dispatchEvent(new CustomEvent('ai-chat:select-conversation', { detail: { conversationId } }));
                }}
                onNewChat={() => {
                  setCurrentConversationId(null);
                  closeDrawer();
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
      </aside>
    </>
  );
};

export default Sidebar;
