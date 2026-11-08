'use client'

import CustomHeader from '@/components/CustomHeader'
import { contentOffset, useSidebar } from '@/contexts/SidebarContext'

type PageShellProps = {
  title: string
  // Fill the viewport below the header instead of scrolling the page (used by the chat)
  fixed?: boolean
  children: React.ReactNode
}

const PageShell = ({ title, fixed = false, children }: PageShellProps) => {
  const { isCollapsed } = useSidebar()

  return (
    <>
      <div className={`fixed top-0 right-0 h-16 md:h-20 flex items-center bg-chrome border-b border-line z-30 transition-all duration-300 ${contentOffset(isCollapsed, 'left')}`}>
        <CustomHeader title={title} />
      </div>

      {fixed ? (
        <div className={`fixed top-16 md:top-20 bottom-0 right-0 flex flex-col bg-surface transition-all duration-300 ${contentOffset(isCollapsed, 'left')}`}>
          {children}
        </div>
      ) : (
        <div className={`bg-surface px-4 sm:px-6 lg:px-10 py-6 lg:py-8 mt-16 md:mt-20 min-h-[calc(100dvh-4rem)] md:min-h-[calc(100dvh-5rem)] transition-all duration-300 ${contentOffset(isCollapsed, 'ml')}`}>
          {children}
        </div>
      )}
    </>
  )
}

export default PageShell
