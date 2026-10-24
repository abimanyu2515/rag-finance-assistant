import { avatarColor, fmt, initials } from '@/lib/dashboard'
import type { Transaction } from '@/types/transaction'

type Props = {
  transactions: Transaction[]
  // Full history view: year in the date and a Status column
  detailed?: boolean
  emptyText?: string
}

const TransactionsTable = ({ transactions, detailed = false, emptyText = 'No transactions in this period' }: Props) => {
  const cols = detailed ? 5 : 4

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-sm min-w-130'>
        <thead>
          <tr className='text-left'>
            <th className='font-medium pb-3'>Description</th>
            <th className='font-medium pb-3'>Date</th>
            <th className='font-medium pb-3'>Category</th>
            {detailed && <th className='font-medium pb-3'>Status</th>}
            <th className='font-medium pb-3 text-right'>Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 && (
            <tr className='border-t border-dashed border-line'>
              <td colSpan={cols} className='py-6 text-center text-ink-subtle'>{emptyText}</td>
            </tr>
          )}
          {transactions.map(tx => {
            const name = tx.merchant || 'Unknown'
            const isCredit = tx.type === 'credit'
            return (
              <tr key={tx._id} className='border-t border-dashed border-line text-ink-muted'>
                <td className='py-3 pl-2'>
                  <div className='flex items-center gap-3'>
                    <span
                      className='size-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-black shrink-0'
                      style={{ background: avatarColor(name) }}
                    >
                      {initials(name)}
                    </span>
                    <span className='text-ink-2'>{name}</span>
                    {!detailed && tx.isSuspicious && (
                      <span className='text-[10px] text-neg bg-neg/10 rounded px-1.5 py-0.5'>Suspicious</span>
                    )}
                  </div>
                </td>
                <td className='py-3'>
                  {new Date(tx.timestamp).toLocaleDateString('en-US', {
                    month: 'short', day: '2-digit', ...(detailed && { year: 'numeric' }),
                  })}
                </td>
                <td className='py-3'>{tx.category || '—'}</td>
                {detailed && (
                  <td className='py-3'>
                    <span className={`text-xs rounded px-2 py-0.5 ${
                      tx.isSuspicious ? 'text-neg bg-neg/10' : 'text-pos bg-pos/10'
                    }`}>
                      {tx.isSuspicious ? 'Suspicious' : 'Normal'}
                    </span>
                  </td>
                )}
                <td className={`py-3 text-right ${isCredit ? 'text-pos' : 'text-ink-2'}`}>
                  {isCredit ? '+' : '-'}{fmt(tx.amount)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default TransactionsTable
