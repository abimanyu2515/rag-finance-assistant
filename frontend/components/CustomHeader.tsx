'use client'

import { LogOut, Menu } from 'lucide-react'
import { useSidebar } from '@/contexts/SidebarContext'
import { signOut, useSession } from 'next-auth/react'
import ThemeToggle from '@/components/ThemeToggle'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

const CustomHeader = ({title}: {title: string}) => {
  const { data: session } = useSession()
  const name = session?.user?.name
  const email = session?.user?.email
  const { setIsDrawerOpen } = useSidebar()

  return (
    <div className='flex w-full min-w-0 items-center justify-between gap-3 px-4 sm:px-6 lg:px-10'>
        <div className='flex min-w-0 items-center gap-2'>
            {/* Phones only: the sidebar is hidden, so open it as a drawer */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className='md:hidden -ml-2 size-10 shrink-0 flex items-center justify-center rounded-lg text-ink-2 hover:bg-control cursor-pointer'
              aria-label='Open menu'
            >
              <Menu size={22} />
            </button>
            <h1 className='text-xl sm:text-2xl lg:text-3xl font-semibold truncate'>{title}</h1>
        </div>

        <div className='flex shrink-0 items-center gap-2 sm:gap-3'>
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger
                className='size-10 rounded-full bg-brand hover:bg-brand-hover text-white font-semibold cursor-pointer transition-colors'
                aria-label='Account menu'
              >
                {name?.charAt(0).toUpperCase() || 'U'}
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='min-w-52 bg-panel border-line text-ink'>
                {(name || email) && (
                  <>
                    <DropdownMenuLabel className='font-normal'>
                      <p className='text-sm font-medium truncate'>{name}</p>
                      <p className='text-xs text-ink-muted truncate'>{email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className='bg-line' />
                  </>
                )}
                <DropdownMenuItem
                  className='cursor-pointer text-ink-2 focus:bg-control focus:text-ink'
                  onClick={() => signOut({ callbackUrl: '/sign-in' })}
                >
                  <LogOut className='size-4' />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </div>
  )
}

export default CustomHeader
