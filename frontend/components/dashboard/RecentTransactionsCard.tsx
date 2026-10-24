import DashboardCard from './DashboardCard'
import TransactionsTable from './TransactionsTable'
import type { Transaction } from '@/types/transaction'

type Props = {
  transactions: Transaction[]
  rangeLabel: string
  className?: string
}

const RecentTransactionsCard = ({ transactions, rangeLabel, className }: Props) => {
  return (
    <DashboardCard
      title='Recent Transactions'
      subtitle={rangeLabel}
      action={{ label: 'View Full History', href: '/transactions' }}
      className={className}
    >
      <div className='mt-6'>
        <TransactionsTable transactions={transactions.slice(0, 6)} />
      </div>
    </DashboardCard>
  )
}

export default RecentTransactionsCard
