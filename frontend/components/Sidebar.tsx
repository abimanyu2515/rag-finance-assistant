'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Receipt, Shield, MessageSquare, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

interface NavItem {
  name: string;
  icon: React.ReactNode;
  href: string;
}

const Sidebar = () => {
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, href: '/dashboard' },
    { name: 'Transactions', icon: <Receipt size={20} />, href: '/transactions' },
    // { name: 'Fraud Detection', icon: <Shield size={20} />, href: '/fraud-detection' },
    { name: 'AI Assistant', icon: <MessageSquare size={20} />, href: '/ai-assistant' },
  ];

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
        </div>

        {/* Settings */}
        <div className="px-3">
          <Link
              key="Settings"
              href="/app-settings"
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 ${
                pathname === '/app-settings'
                  ? 'bg-[#6366f1] text-white'
                  : 'text-gray-400 hover:bg-[#2d3748] hover:text-white'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? 'Settings' : ''}
            >
              <span className="flex shrink-0"><Settings size={20} /></span>
              {!isCollapsed && (
                <span className="text-sm font-medium whitespace-nowrap">Settings</span>
              )}
            </Link>
        </div>
      </nav>
    </div>
  );
};

export default Sidebar;