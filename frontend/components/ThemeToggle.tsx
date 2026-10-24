'use client'

import { useLayoutEffect } from 'react'
import { Moon, Sun } from 'lucide-react'

const STORAGE_KEY = 'theme'

const applyTheme = (theme: string | null) => {
  document.documentElement.classList.toggle('dark', theme !== 'light')
}

const ThemeToggle = () => {
  // The inline script in app/layout.tsx applies the saved theme before paint. React's dev
  // remount resets <html> attributes, so re-apply here too (a no-op in production).
  useLayoutEffect(() => {
    try { applyTheme(localStorage.getItem(STORAGE_KEY)) } catch {}
  }, [])

  const toggle = () => {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
    applyTheme(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  }

  // Icons switch through the dark: variant, so server and client render the same markup
  return (
    <button
      onClick={toggle}
      className='size-10 flex items-center justify-center rounded-full bg-control hover:bg-control-hover text-ink-2 transition-colors cursor-pointer'
      aria-label='Toggle dark mode'
      title='Toggle dark mode'
    >
      <Sun className='size-5 hidden dark:block' />
      <Moon className='size-5 dark:hidden' />
    </button>
  )
}

export default ThemeToggle
