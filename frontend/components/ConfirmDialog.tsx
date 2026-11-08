'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertDialog } from 'radix-ui'

export type ConfirmOptions = {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * In-app replacement for window.confirm():
 *   const confirm = useConfirm()
 *   if (await confirm({ title: 'Delete chat?', destructive: true })) { ... }
 */
export const useConfirm = () => {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}

export const ConfirmProvider = ({ children }: { children: React.ReactNode }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    resolver.current?.(false) // a newer question cancels any pending one
    setOptions(opts)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOpen(false)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={open} onOpenChange={(o) => !o && settle(false)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className='fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0' />
          <AlertDialog.Content className='fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-panel p-6 text-ink shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'>
            <AlertDialog.Title className='text-lg font-medium'>{options?.title}</AlertDialog.Title>
            {options?.description ? (
              <AlertDialog.Description className='mt-2 text-sm text-ink-muted'>{options.description}</AlertDialog.Description>
            ) : (
              <AlertDialog.Description className='sr-only'>{options?.title}</AlertDialog.Description>
            )}
            <div className='mt-6 flex justify-end gap-3'>
              <AlertDialog.Cancel
                onClick={() => settle(false)}
                className='rounded-lg bg-control px-4 py-2 text-sm text-ink-2 transition-colors hover:bg-control-hover cursor-pointer'
              >
                {options?.cancelLabel ?? 'Cancel'}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                onClick={() => settle(true)}
                className={`rounded-lg px-4 py-2 text-sm text-white transition-colors cursor-pointer ${
                  options?.destructive ? 'bg-neg hover:opacity-90' : 'bg-brand hover:bg-brand-hover'
                }`}
              >
                {options?.confirmLabel ?? 'Confirm'}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  )
}
