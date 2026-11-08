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
  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: '2-digit', ...(detailed && { year: 'numeric' }) })

  return (
    <div className='overflow-x-auto'>
      {/* Phones: Date/Category fold under the name; full columns from sm, Status from md */}
      <table className='w-full text-sm sm:min-w-130'>
        <thead>
          <tr className='text-left'>
            <th className='font-medium pb-3'>Description</th>
            <th className='hidden sm:table-cell font-medium pb-3'>Date</th>
            <th className='hidden sm:table-cell font-medium pb-3'>Category</th>
            {detailed && <th className='hidden md:table-cell font-medium pb-3'>Status</th>}
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
                    <div className='min-w-0'>
                      <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                        <span className='text-ink-2 wrap-break-word'>{name}</span>
                        {tx.isSuspicious && (
                          <span className={`text-[10px] text-neg bg-neg/10 rounded px-1.5 py-0.5 ${detailed ? 'md:hidden' : ''}`}>
                            Suspicious
                          </span>
                        )}
                      </div>
                      <p className='sm:hidden text-xs text-ink-subtle mt-0.5'>
                        {formatDate(tx.timestamp)}{tx.category ? ` · ${tx.category}` : ''}
                      </p>
                    </div>
                  </div>
                </td>
                <td className='hidden sm:table-cell py-3 whitespace-nowrap pr-3'>{formatDate(tx.timestamp)}</td>
                <td className='hidden sm:table-cell py-3 pr-3'>{tx.category || '—'}</td>
                {detailed && (
                  <td className='hidden md:table-cell py-3'>
                    <span className={`text-xs rounded px-2 py-0.5 ${
                      tx.isSuspicious ? 'text-neg bg-neg/10' : 'text-pos bg-pos/10'
                    }`}>
                      {tx.isSuspicious ? 'Suspicious' : 'Normal'}
                    </span>
                  </td>
                )}
                <td className={`py-3 pl-3 text-right whitespace-nowrap align-top sm:align-middle ${isCredit ? 'text-pos' : 'text-ink-2'}`}>
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
