'use client'

import { LogOut } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import ThemeToggle from '@/components/ThemeToggle'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

const CustomHeader = ({title}: {title: string}) => {
  const { data: session } = useSession()
  const name = session?.user?.name
  const email = session?.user?.email

  return (
    <div className='flex w-full items-center justify-between mx-6 lg:mx-10'>
        <h1 className='text-3xl font-semibold'>{title}</h1>

        <div className='flex items-center gap-3'>
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
