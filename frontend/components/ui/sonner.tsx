'use client'

import { Toaster as Sonner } from 'sonner'

// App-wide toasts, styled with the app's theme tokens so they follow light/dark.
export const Toaster = () => (
  <Sonner
    position='bottom-right'
    closeButton
    toastOptions={{
      unstyled: true,
      classNames: {
        toast:
          'flex w-full items-start gap-3 rounded-xl border border-line bg-panel p-4 text-sm text-ink shadow-lg sm:w-[360px]',
        title: 'font-medium',
        description: 'text-ink-muted text-xs mt-0.5',
        icon: 'mt-0.5',
        success: '[&_[data-icon]]:text-pos',
        error: '[&_[data-icon]]:text-neg',
        closeButton:
          'border-line! bg-panel! text-ink-muted! hover:bg-control!',
      },
    }}
  />
)
