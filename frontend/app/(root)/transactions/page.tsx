'use client'

import CustomHeader from '@/components/CustomHeader'
import { transactions } from '@/constants';
import { useSidebar } from '@/contexts/SidebarContext'

const Transactions = () => {
  const { isCollapsed } = useSidebar();
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
          
          {transactions.map(({ id, merchant, category, amount, date, status }) => (
            <tbody key={id}>
              <tr className='border'>
                <td className='py-5 pl-3'>{merchant}</td>
                <td>{category}</td>
                <td>₹{amount}</td>
                <td>{date}</td>
                <td>{status}</td>
              </tr>
            </tbody>
          ))}
        </table>
      </div>
      </div>
    </>
  )
}

export default Transactions
