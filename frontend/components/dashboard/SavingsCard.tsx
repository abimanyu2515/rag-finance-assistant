import DashboardCard from './DashboardCard'
import { fmtCompact } from '@/lib/dashboard'
import type { Transaction } from '@/types/transaction'

const SavingsCard = ({ transactions }: { transactions: Transaction[] }) => {
  const income = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  const spending = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0)
  const saved = income - spending
  const pct = income > 0 ? Math.max(0, (saved / income) * 100) : 0

  return (
    <DashboardCard
      title='Savings'
      subtitle={
        saved >= 0
          ? <>{pct.toFixed(1)}% of income saved so far.<br />Keep it up!</>
          : <>Spending exceeds income by {fmtCompact(-saved)}.</>
      }
    >
      <p className='mt-6 text-2xl'>
        <span className={saved < 0 ? 'text-neg' : ''}>{saved < 0 && '-'}{fmtCompact(Math.abs(saved))}</span>
        <span className='text-sm text-ink-subtle ml-2'>of {fmtCompact(income)}</span>
      </p>
      <div className='mt-4 h-2.5 rounded-full bg-control overflow-hidden'>
        <div className='h-full rounded-full bg-brand transition-all' style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </DashboardCard>
  )
}

export default SavingsCard
