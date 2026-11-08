'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePlaidLink, type PlaidLinkOnExit, type PlaidLinkOnSuccess } from 'react-plaid-link'
import { ChevronDown, Landmark, Loader2, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ConfirmDialog'

type ImportResult = { inserted: number; skipped: number; embedded: number; embedError?: string; pending?: boolean }
type PlaidItem = { _id: string; institutionName: string | null }

const PERSONAS = [
  { key: 'student', label: 'Student', hint: '₹19k stipend, PG rent' },
  { key: 'young_professional', label: 'Young professional', hint: '₹85k salary, rent, SIP' },
  { key: 'family', label: 'Family', hint: '₹1.4L salary, home loan EMI' },
] as const

const itemClass = 'cursor-pointer text-ink-2 focus:bg-control focus:text-ink'

type Outcome = { title: string; description?: string; warning?: boolean }

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

const describe = (title: string, r: ImportResult): Outcome => {
  if (r.pending) {
    return { title, description: 'The bank is still preparing transactions. Try Re-sync in a few seconds.', warning: true }
  }
  const parts = [`${r.inserted} added`]
  if (r.skipped) parts.push(`${r.skipped} already imported`)
  if (r.embedError) {
    return {
      title,
      description: `${parts.join(' · ')}. Not yet searchable by the assistant: ${r.embedError}`,
      warning: true,
    }
  }
  return { title, description: parts.join(' · ') }
}

// Mounted only while a link token exists, so Plaid's script is loaded on
// demand instead of on every visit to the Transactions page.
const PlaidLauncher = ({ token, onSuccess, onExit }: {
  token: string
  onSuccess: PlaidLinkOnSuccess
  onExit: PlaidLinkOnExit
}) => {
  const { open, ready } = usePlaidLink({ token, onSuccess, onExit })
  useEffect(() => {
    if (ready) open()
  }, [ready, open])
  return null
}

const AddDataMenu = ({ onChange }: { onChange: () => void }) => {
  const { data: session } = useSession()
  const accessToken = (session as { accessToken?: string } | null)?.accessToken
  const [busy, setBusy] = useState<string | null>(null)
  const [items, setItems] = useState<PlaidItem[]>([])
  const confirm = useConfirm()
  const [linkToken, setLinkToken] = useState<string | null>(null)

  const api = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const r = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...init.headers },
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error ?? `Request failed (${r.status})`)
      return data as T
    },
    [accessToken]
  )

  const loadItems = useCallback(async () => {
    if (!accessToken) return
    try {
      setItems(await api<PlaidItem[]>('/api/plaid/items'))
    } catch {
      setItems([]) // Plaid not configured on the backend: just hide bank actions
    }
  }, [accessToken, api])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the await
    loadItems()
  }, [loadItems])

  // Shows a loading toast, then replaces it with the outcome.
  const run = async (label: string, pending: string, failure: string, fn: () => Promise<Outcome>) => {
    setBusy(label)
    const id = toast.loading(pending)
    try {
      const { title, description, warning } = await fn()
      ;(warning ? toast.warning : toast.success)(title, { id, description })
      onChange()
    } catch (e) {
      toast.error(failure, { id, description: errorText(e) })
    } finally {
      setBusy(null)
    }
  }

  const loadDemo = (persona: string) =>
    run('demo', 'Generating demo transactions…', 'Couldn’t load demo data', async () =>
      describe('Demo data loaded', await api<ImportResult>('/api/transactions/demo', {
        method: 'POST',
        body: JSON.stringify({ persona, months: 6 }),
      }))
    )

  const clear = async (source: 'demo' | 'plaid') => {
    const ok = await confirm(
      source === 'demo'
        ? {
            title: 'Clear demo data?',
            description: 'All demo transactions will be deleted. Bank and manually added transactions are kept.',
            confirmLabel: 'Clear demo data',
            destructive: true,
          }
        : {
            title: 'Disconnect bank?',
            description: 'The bank connection and every transaction imported from it will be removed.',
            confirmLabel: 'Disconnect',
            destructive: true,
          }
    )
    if (!ok) return
    await run('clear', 'Removing transactions…', 'Couldn’t remove transactions', async () => {
      const { deleted } = await api<{ deleted: number }>(`/api/transactions?source=${source}`, { method: 'DELETE' })
      if (source === 'plaid') await loadItems()
      return {
        title: source === 'demo' ? 'Demo data cleared' : 'Bank disconnected',
        description: `${deleted} transaction${deleted === 1 ? '' : 's'} removed`,
      }
    })
  }

  const resync = () =>
    run('sync', 'Syncing bank transactions…', 'Bank sync failed', async () =>
      describe('Bank synced', await api<ImportResult>('/api/plaid/sync', { method: 'POST' }))
    )

  // Plaid Link: fetch a link token, then PlaidLauncher opens the widget.
  const onPlaidSuccess: PlaidLinkOnSuccess = (publicToken, metadata) => {
    setLinkToken(null)
    run('plaid', 'Importing bank transactions…', 'Couldn’t connect the bank', async () => {
      const result = await api<ImportResult>('/api/plaid/exchange', {
        method: 'POST',
        body: JSON.stringify({ publicToken, institutionName: metadata.institution?.name }),
      })
      await loadItems()
      return describe(`${metadata.institution?.name ?? 'Bank'} connected`, result)
    })
  }

  const onPlaidExit: PlaidLinkOnExit = (err) => {
    setLinkToken(null)
    setBusy(null)
    if (err) toast.error('Bank connection failed', { description: err.display_message ?? err.error_message })
  }

  const connectBank = async () => {
    setBusy('plaid')
    try {
      const { linkToken } = await api<{ linkToken: string }>('/api/plaid/link-token', { method: 'POST' })
      setLinkToken(linkToken)
    } catch (e) {
      setBusy(null)
      toast.error('Couldn’t start the bank connection', { description: errorText(e) })
    }
  }

  return (
    <>
      {linkToken && <PlaidLauncher token={linkToken} onSuccess={onPlaidSuccess} onExit={onPlaidExit} />}
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={!accessToken || !!busy}
          className='flex items-center gap-2 bg-brand hover:bg-brand-hover text-white rounded-lg px-4 py-2.5 text-sm cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-default'
        >
          {busy ? <Loader2 size={16} className='animate-spin' /> : <Plus size={16} />}
          Add data
          <ChevronDown size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='min-w-64 bg-panel border-line text-ink'>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={itemClass}>
              <Sparkles className='size-4' />
              Load demo data
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className='bg-panel border-line text-ink'>
              <DropdownMenuLabel className='text-xs text-ink-muted font-normal'>6 months of INR transactions</DropdownMenuLabel>
              {PERSONAS.map(p => (
                <DropdownMenuItem key={p.key} className={`${itemClass} flex-col items-start gap-0`} onClick={() => loadDemo(p.key)}>
                  <span className='text-sm'>{p.label}</span>
                  <span className='text-xs text-ink-muted'>{p.hint}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem className={`${itemClass} items-start`} onClick={connectBank}>
            <Landmark className='size-4 mt-0.5' />
            <span className='flex flex-col'>
              <span className='text-sm'>Connect bank</span>
              <span className='text-xs text-ink-muted'>Plaid Sandbox · USD converted to INR</span>
            </span>
          </DropdownMenuItem>

          {items.length > 0 && (
            <DropdownMenuItem className={itemClass} onClick={resync}>
              <RefreshCw className='size-4' />
              Re-sync {items.length === 1 ? items[0].institutionName ?? 'bank' : `${items.length} banks`}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className='bg-line' />
          <DropdownMenuItem className={itemClass} onClick={() => clear('demo')}>
            <Trash2 className='size-4' />
            Clear demo data
          </DropdownMenuItem>
          {items.length > 0 && (
            <DropdownMenuItem className={itemClass} onClick={() => clear('plaid')}>
              <Trash2 className='size-4' />
              Disconnect bank &amp; remove its data
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

    </>
  )
}

export default AddDataMenu
