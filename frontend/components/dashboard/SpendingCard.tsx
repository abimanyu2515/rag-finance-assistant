'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import DashboardCard from './DashboardCard'
import { fmt, fmtCompact } from '@/lib/dashboard'
import type { Transaction } from '@/types/transaction'

// CSS variables from globals.css, so the ring follows the light/dark theme
const SLICE_COLORS = ['var(--app-peach)', 'var(--app-brand)', '#ef4444', '#0ea5e9']
const OTHER_COLOR = 'var(--app-ink-subtle)'
const EMPTY_COLOR = 'var(--app-control)'

type Props = {
  transactions: Transaction[]
  rangeLabel: string
  // Spending in the equal-length period before the selected range; null when not comparable
  previousSpend: number | null
}

const SpendingCard = ({ transactions, rangeLabel, previousSpend }: Props) => {
  const debits = transactions.filter(t => t.type === 'debit')
  const total = debits.reduce((s, t) => s + t.amount, 0)

  // Category share of total spend: top 4 categories, the rest folded into "Other"
  const catMap: Record<string, number> = {}
  debits.forEach(t => {
    const cat = t.category || 'Other'
    catMap[cat] = (catMap[cat] || 0) + t.amount
  })
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 4)
  const rest = sorted.slice(4).reduce((s, [, v]) => s + v, 0)
  const categoryData = [
    ...top.map(([name, value], i) => ({ name, value, color: SLICE_COLORS[i] })),
    ...(rest > 0 ? [{ name: 'Other', value: rest, color: OTHER_COLOR }] : []),
  ]

  const change = previousSpend ? ((total - previousSpend) / previousSpend) * 100 : null

  return (
    <DashboardCard title='Spending' subtitle={rangeLabel} action={{ label: 'View more', href: '/transactions' }}>
      <div className='flex flex-1 items-center gap-6 mt-5'>
        <div className='relative size-36 shrink-0'>
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie
                data={categoryData.length ? categoryData : [{ name: 'None', value: 1, color: EMPTY_COLOR }]}
                dataKey='value'
                innerRadius='86%'
                outerRadius='100%'
                paddingAngle={categoryData.length > 1 ? 2 : 0}
                startAngle={90}
                endAngle={-270}
                stroke='none'
              >
                {(categoryData.length ? categoryData : [{ color: EMPTY_COLOR }]).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              {categoryData.length > 0 && (
                <Tooltip
                  contentStyle={{ background: 'var(--app-panel)', border: '1px solid var(--app-line)', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: 'var(--app-ink-2)' }}
                  formatter={(value) => fmt(Number(value))}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
          <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
            <span className='text-xl'>{fmtCompact(total)}</span>
            {change !== null && (
              <span className={`text-xs mt-0.5 ${change > 0 ? 'text-neg' : 'text-pos'}`}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        <ul className='flex-1 space-y-3 min-w-0'>
          {categoryData.length === 0 && <li className='text-sm text-ink-subtle'>No spending yet</li>}
          {categoryData.map(c => (
            <li key={c.name} className='flex items-center justify-between gap-3 text-sm'>
              <span className='flex items-center gap-2.5 min-w-0'>
                <span className='size-2.5 rounded-full shrink-0' style={{ background: c.color }} />
                <span className='truncate'>{c.name}</span>
              </span>
              <span className='text-ink-muted'>{Math.round((c.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </DashboardCard>
  )
}

export default SpendingCard
