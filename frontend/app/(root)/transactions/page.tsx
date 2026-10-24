'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import PageShell from '@/components/PageShell'
import DashboardCard from '@/components/dashboard/DashboardCard'
import RangeSelect from '@/components/dashboard/RangeSelect'
import TransactionsTable from '@/components/dashboard/TransactionsTable'
import { type RangeKey, applyRange, fmt } from '@/lib/dashboard'
import { useTransactions } from '@/lib/useTransactions'

type Filter = 'all' | 'credit' | 'debit' | 'suspicious'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'credit', label: 'Income' },
  { key: 'debit', label: 'Spending' },
  { key: 'suspicious', label: 'Suspicious' },
]

const Transactions = () => {
  const { transactions, loading } = useTransactions()
  const [range, setRange] = useState<RangeKey>('all')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const { filtered: inRange, rangeLabel } = useMemo(() => applyRange(transactions, range), [transactions, range])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return inRange
      .filter(t =>
        filter === 'all' ? true :
        filter === 'suspicious' ? t.isSuspicious :
        t.type === filter
      )
      .filter(t => !q || `${t.merchant ?? ''} ${t.category ?? ''}`.toLowerCase().includes(q))
  }, [inRange, filter, query])

  const income = inRange.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  const spending = inRange.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0)
  const flagged = inRange.filter(t => t.isSuspicious).length

  const summary = [
    { label: 'Transactions', value: String(inRange.length), tone: '' },
    { label: 'Income', value: fmt(income), tone: 'text-pos' },
    { label: 'Spending', value: fmt(spending), tone: '' },
    { label: 'Suspicious', value: String(flagged), tone: flagged ? 'text-neg' : '' },
  ]

  return (
    <PageShell title='Transactions'>
      <div className='flex flex-wrap items-center justify-between gap-4 mb-8'>
        <p className='text-sm text-ink-muted'>Every transaction on your account, newest first:</p>
        <RangeSelect value={range} onChange={setRange} label={rangeLabel} />
      </div>

      <div className='grid grid-cols-2 xl:grid-cols-4 gap-6 mb-6'>
        {summary.map(s => (
          <div key={s.label} className='bg-panel border border-line-soft rounded-2xl px-6 py-5'>
            <p className='text-xs text-ink-muted font-medium'>{s.label}</p>
            <p className={`text-2xl mt-2 ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <DashboardCard title='All Transactions' subtitle={rangeLabel}>
        <div className='flex flex-wrap items-center justify-between gap-4 mt-6 mb-4'>
          <div className='flex gap-2'>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-xs rounded-md px-3 py-1.5 transition-colors cursor-pointer ${
                  filter === f.key ? 'bg-brand text-white' : 'bg-control text-ink-2 hover:bg-control-hover'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <label className='flex items-center gap-2 bg-control border border-line focus-within:border-line-strong rounded-lg px-3 py-2 w-full sm:w-64'>
            <Search size={16} className='text-ink-subtle shrink-0' />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search merchant or category'
              className='bg-transparent text-sm outline-none w-full placeholder:text-ink-subtle'
            />
          </label>
        </div>

        {loading ? (
          <p className='py-6 text-center text-sm text-ink-subtle'>Loading transactions…</p>
        ) : (
          <TransactionsTable
            transactions={visible}
            detailed
            emptyText={transactions.length ? 'No transactions match these filters' : 'No transactions yet'}
          />
        )}
      </DashboardCard>
    </PageShell>
  )
}

export default Transactions
