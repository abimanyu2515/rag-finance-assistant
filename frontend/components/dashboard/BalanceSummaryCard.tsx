'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import DashboardCard from './DashboardCard'
import { fmt, fmtCompact, fmtDayMonth } from '@/lib/dashboard'
import type { Transaction } from '@/types/transaction'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
// CSS variables from globals.css, so the chart follows the light/dark theme
export const INCOME_COLOR = 'var(--app-peach)'
export const SPENDING_COLOR = 'var(--app-brand)'

type Props = {
  transactions: Transaction[]
  rangeLabel: string
  byDay: boolean
}

const BalanceSummaryCard = ({ transactions, rangeLabel, byDay }: Props) => {
  // Income (credits) vs spending (debits), grouped by day or month, oldest first
  const buckets = new Map<string, { name: string; income: number; spending: number; t: number }>()
  transactions.forEach(tx => {
    const d = new Date(tx.timestamp)
    const start = byDay ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : new Date(d.getFullYear(), d.getMonth(), 1)
    const key = start.toISOString()
    const name = byDay ? fmtDayMonth(start) : `${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()}`
    const b = buckets.get(key) ?? { name, income: 0, spending: 0, t: start.getTime() }
    if (tx.type === 'credit') b.income += tx.amount
    else b.spending += tx.amount
    buckets.set(key, b)
  })
  const data = [...buckets.values()].sort((a, b) => a.t - b.t)

  const income = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  const spending = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0)
  const balance = income - spending

  return (
    <DashboardCard title='Balance Summary' subtitle={rangeLabel} action={{ label: 'View more', href: '/transactions' }}>
      <p className='mt-4 text-2xl'>
        {balance < 0 && '-'}{fmt(Math.abs(balance))}
        <span className={`ml-2 text-xs ${balance >= 0 ? 'text-pos' : 'text-neg'}`}>
          {balance >= 0 ? 'Surplus' : 'Deficit'}
        </span>
      </p>

      <div className='h-36 mt-2 -mx-2'>
        {data.length > 0 ? (
          <ResponsiveContainer width='100%' height='100%'>
            <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} stroke='var(--app-line)' strokeDasharray='3 4' />
              <XAxis dataKey='name' hide />
              <Tooltip
                contentStyle={{ background: 'var(--app-panel)', border: '1px solid var(--app-line)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--app-ink-muted)' }}
                formatter={(value) => fmt(Number(value))}
              />
              <Line type='monotone' dataKey='income' name='Income' stroke={INCOME_COLOR} strokeWidth={2} dot={false} />
              <Line type='monotone' dataKey='spending' name='Spending' stroke={SPENDING_COLOR} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className='h-full flex items-center justify-center text-sm text-ink-subtle'>No data for this period</div>
        )}
      </div>

      <div className='flex flex-wrap gap-x-8 gap-y-2 mt-4 text-sm text-ink-2'>
        <span className='flex items-center gap-2'>
          <span className='size-2.5 rounded-full' style={{ background: INCOME_COLOR }} />
          Income <span className='text-ink-subtle'>{fmtCompact(income)}</span>
        </span>
        <span className='flex items-center gap-2'>
          <span className='size-2.5 rounded-full' style={{ background: SPENDING_COLOR }} />
          Spending <span className='text-ink-subtle'>{fmtCompact(spending)}</span>
        </span>
      </div>
    </DashboardCard>
  )
}

export default BalanceSummaryCard
