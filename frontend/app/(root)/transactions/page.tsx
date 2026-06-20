'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import CustomHeader from '@/components/CustomHeader'
import { useSidebar } from '@/contexts/SidebarContext'

const Transactions = () => {
  const { isCollapsed } = useSidebar()
  const { data: session } = useSession()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!(session as any)?.accessToken) return
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/transactions`, {
      headers: { Authorization: `Bearer ${(session as any).accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? setTransactions(data) : null)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [session])

  console.log("Transactions:", transactions)

  return (
    <>
      <div className={`fixed top-0 right-0 h-20 flex items-center bg-[#11213d] border-b z-30 transition-all duration-300 ${
        isCollapsed ? 'left-20' : 'left-64'
      }`}>
        <CustomHeader title='TRANSACTIONS' />
      </div>

      <div className={`bg-[#01122e] px-5 py-5 mt-15 min-h-screen transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}>
        <div className='rounded-lg mt-7'>
          <h1 className='text-xl font-medium'>All Transactions</h1>
          {loading ? (
            <p className='mt-7 text-gray-400'>Loading transactions…</p>
          ) : (
            <table className='w-full mt-7 border-collapse'>
              <thead className='bg-blue-300 text-black'>
                <tr className='border font-normal border-white'>
                  <td className='px-3 py-4'>Merchant</td>
                  <td>Category</td>
                  <td>Amount</td>
                  <td>Date</td>
                  <td>Status</td>
                </tr>
              </thead>
              {transactions.map((tx) => (
                <tbody key={tx._id}>
                  <tr className='border'>
                    <td className='py-5 pl-3'>{tx.merchant || 'Unknown'}</td>
                    <td>{tx.category || '—'}</td>
                    <td>₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>{new Date(tx.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className={tx.isSuspicious ? 'text-red-400' : 'text-green-400'}>
                      {tx.isSuspicious ? 'Suspicious' : 'Normal'}
                    </td>
                  </tr>
                </tbody>
              ))}
            </table>
          )}
        </div>
      </div>
    </>
  )
}

export default Transactions
