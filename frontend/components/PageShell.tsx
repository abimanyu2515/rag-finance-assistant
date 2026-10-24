'use client'

import CustomHeader from '@/components/CustomHeader'
import { useSidebar } from '@/contexts/SidebarContext'

type PageShellProps = {
  title: string
  // Fill the viewport below the header instead of scrolling the page (used by the chat)
  fixed?: boolean
  children: React.ReactNode
}

const PageShell = ({ title, fixed = false, children }: PageShellProps) => {
  const { isCollapsed } = useSidebar()
  const offset = isCollapsed ? 'left-20' : 'left-64'

  return (
    <>
      <div className={`fixed top-0 right-0 h-20 flex items-center bg-chrome border-b border-line z-30 transition-all duration-300 ${offset}`}>
        <CustomHeader title={title} />
      </div>

      {fixed ? (
        <div className={`fixed top-20 bottom-0 right-0 flex flex-col bg-surface transition-all duration-300 ${offset}`}>
          {children}
        </div>
      ) : (
        <div className={`bg-surface px-6 lg:px-10 py-8 mt-20 min-h-[calc(100vh-5rem)] transition-all duration-300 ${
          isCollapsed ? 'ml-20' : 'ml-64'
        }`}>
          {children}
        </div>
      )}
    </>
  )
}

export default PageShell
