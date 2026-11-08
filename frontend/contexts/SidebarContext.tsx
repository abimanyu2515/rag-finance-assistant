'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Sidebar layout by breakpoint (all driven by CSS classes, so the first paint is right):
 *   lg+ (desktop)   docked; `isCollapsed` toggles full width <-> icon rail
 *   md–lg (tablet)  icon rail; `isDrawerOpen` slides the full menu over the page
 *   < md (phone)    hidden; `isDrawerOpen` slides it in from the left with a backdrop
 */
interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Close the drawer on Escape, and when the window grows to desktop width
  useEffect(() => {
    if (!isDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsDrawerOpen(false);
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onResize = () => desktop.matches && setIsDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onResize);
    };
  }, [isDrawerOpen]);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, isDrawerOpen, setIsDrawerOpen }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

// Left offset for content next to the docked sidebar (none on phones)
export const contentOffset = (isCollapsed: boolean, kind: 'left' | 'ml') =>
  kind === 'left'
    ? `left-0 md:left-20 ${isCollapsed ? 'lg:left-20' : 'lg:left-64'}`
    : `ml-0 md:ml-20 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`;
