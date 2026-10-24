import DashboardCard from './DashboardCard'
import { fmt, fmtDayMonth } from '@/lib/dashboard'
import type { Transaction } from '@/types/transaction'

// Later rows fade out, like a list that continues beyond the card
const ROW_OPACITY = ['opacity-100', 'opacity-100', 'opacity-60', 'opacity-35']

const FraudAlertsCard = ({ transactions }: { transactions: Transaction[] }) => {
  const flagged = transactions.filter(t => t.isSuspicious)

  return (
    <DashboardCard
      title='Fraud Alerts'
      subtitle={flagged.length === 0 ? 'No suspicious activity' : `${flagged.length} need attention`}
      action={{ label: 'See all', href: '/transactions' }}
    >
      {flagged.length === 0 ? (
        <div className='flex flex-1 items-center justify-center mt-5 rounded-lg bg-control py-8 text-sm text-pos'>
          All transactions look normal
        </div>
      ) : (
        <ul className='mt-5 space-y-2'>
          {flagged.slice(0, 4).map((tx, i) => (
            <li key={tx._id} className={`flex gap-1.5 text-sm ${ROW_OPACITY[i]}`}>
              <div className='flex flex-1 items-center gap-4 min-w-0 bg-control rounded-md px-3 py-2.5'>
                <span className='text-ink-muted shrink-0'>{fmtDayMonth(tx.timestamp)}</span>
                <span className='truncate'>{tx.merchant || 'Unknown'}</span>
              </div>
              <div className='bg-control rounded-md px-3 py-2.5 text-neg shrink-0'>
                {tx.type === 'debit' ? '-' : '+'}{fmt(tx.amount)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}

export default FraudAlertsCard
