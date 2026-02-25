'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import CustomHeader from '@/components/CustomHeader'
import CustomStats from '@/components/CustomStats'
import { DollarSign, BanknoteArrowDown, PiggyBank, TriangleAlert } from 'lucide-react'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useSidebar } from '@/contexts/SidebarContext'

const CATEGORY_COLORS: Record<string, string> = {
  Groceries: '#6366f1',
  Shopping: '#f59e0b',
  Dining: '#10b981',
  Bills: '#a855f7',
  Transport: '#ef4444',
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const fmt = (n: number) =>
  `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const Dashboard = () => {
  const { isCollapsed } = useSidebar()
  const { data: session } = useSession()
  const [txList, setTxList] = useState<any[]>([])

  useEffect(() => {
    if (!(session as any)?.accessToken) return
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/transactions`, {
      headers: { Authorization: `Bearer ${(session as any).accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? setTxList(data) : null)
      .catch(console.error)
  }, [session])

  // ── Derive KPI values ──
  const totalCredit = txList.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
  const totalDebit  = txList.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0)
  const balance     = totalCredit - totalDebit
  const now         = new Date()
  const monthlySpend = txList
    .filter(t => t.type === 'debit' &&
      new Date(t.timestamp).getMonth() === now.getMonth() &&
      new Date(t.timestamp).getFullYear() === now.getFullYear())
    .reduce((s, t) => s + t.amount, 0)
  const fraudCount = txList.filter(t => t.isSuspicious).length

  const stats = [
    { title: 'Total Balance',    icon: DollarSign,        value: fmt(balance),      info: balance >= 0 ? `+Surplus of ${fmt(balance)}` : `Deficit of ${fmt(Math.abs(balance))}` },
    { title: 'Monthly Spending', icon: BanknoteArrowDown,  value: fmt(monthlySpend), info: `-Spent this month` },
    { title: 'Total Credits',    icon: PiggyBank,          value: fmt(totalCredit),  info: `+Total money received` },
    { title: 'Fraud Alerts',     icon: TriangleAlert,      value: String(fraudCount),info: fraudCount === 0 ? '+No suspicious activity' : `${fraudCount} need attention` },
  ]

  // ── Spending trend: debit totals grouped by month ──
  const trendMap: Record<string, number> = {}
  txList.filter(t => t.type === 'debit').forEach(t => {
    const d = new Date(t.timestamp)
    const key = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`
    trendMap[key] = (trendMap[key] || 0) + t.amount
  })
  const trendData = Object.entries(trendMap).map(([name, uv]) => ({ name, uv }))

  // ── Category distribution: % of total debit spend ──
  const catMap: Record<string, number> = {}
  txList.filter(t => t.type === 'debit').forEach(t => {
    const cat = t.category || 'Other'
    catMap[cat] = (catMap[cat] || 0) + t.amount
  })
  const categoryData = totalDebit > 0
    ? Object.entries(catMap).map(([name, value]) => ({
        name,
        value: Math.round((value / totalDebit) * 100),
        color: CATEGORY_COLORS[name] || '#94a3b8',
      }))
    : []

  const recentTrans = txList.slice(0, 5)

  return (
    <>
      <div
        className={`fixed top-0 right-0 h-20 flex items-center bg-[#11213d] border-b z-30 transition-all duration-300 ${
          isCollapsed ? 'left-20' : 'left-64'
        }`}
      >
          <CustomHeader title='DASHBOARD' />
      </div>

      <div className={`bg-[#01122e] px-10 py-10 mt-20 min-h-screen transition-all duration-300 ${
        isCollapsed ? 'ml-20' : 'ml-64'
      }`}>
        <div className='grid grid-cols-4 gap-7'>
          {stats.map(({ title, icon, value, info }) => (
            <CustomStats
              key={title}
              title={title}
              icon={icon}
              value={value}
              info={info}
            />
          ))}
        </div>

        <div className='grid grid-cols-2 mt-7 gap-7'>
          <div className='bg-[#092e72] rounded-lg py-7 pl-7'>
            <h1 className='font-medium'>Spending Trend</h1>
            <div className='mt-5'>
              <LineChart
                style={{ width: '100%', aspectRatio: 1.618, maxWidth: 600 }}
                responsive
                data={trendData}
                margin={{ top: 20, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid stroke="gray" strokeDasharray="1 2" />
                <Line type="monotone" dataKey="uv" stroke="blue" strokeWidth={2} name="amount" />
                <XAxis stroke='white' dataKey="name" />
                <YAxis stroke='white' width="auto" label={{ value: '', position: 'insideLeft', angle: -90 }} />
                <Tooltip labelStyle={{ color: 'black' }} />
              </LineChart>
            </div>
          </div>

          <div className='bg-[#092e72] rounded-lg py-7 pl-7'>
            <h1 className='font-medium'>Category Distribution</h1>
            <div className='mt-5 flex items-center justify-center'>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} ${value}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className='bg-[#092e72] rounded-lg mt-7 pt-7'>
          <h1 className='text-xl font-medium ml-5'>Recent Transactions</h1>
          <table className='w-full mt-7 border-collapse'>
            <thead className='bg-blue-300 text-black'>
              <tr className='border-y font-normal border-white'>
                <td className='px-3 py-2'>Merchant</td>
                <td>Category</td>
                <td>Amount</td>
                <td>Date</td>
                <td>Status</td>
              </tr>
            </thead>
            {recentTrans.map((tx) => (
              <tbody key={tx._id}>
                <tr className='border-b'>
                  <td className='py-3 pl-3'>{tx.merchant || 'Unknown'}</td>
                  <td className='py-3'>{tx.category || '—'}</td>
                  <td className='py-3'>₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className='py-3'>{new Date(tx.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className={`py-3 ${tx.isSuspicious ? 'text-red-400' : 'text-green-400'}`}>
                    {tx.isSuspicious ? 'Suspicious' : 'Normal'}
                  </td>
                </tr>
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </>
  )
}

export default Dashboard
