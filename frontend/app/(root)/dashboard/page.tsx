'use client'

import CustomHeader from '@/components/CustomHeader'
import CustomStats from '@/components/CustomStats'
import { recentTrans, stats } from '@/constants'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useSidebar } from '@/contexts/SidebarContext'

const data = [
  { name: 'Jan', uv: 4200 },
  { name: 'Feb', uv: 3800 },
  { name: 'Mar', uv: 4600 },
  { name: 'Apr', uv: 5200 },
  { name: 'May', uv: 4800 },
  { name: 'Jun', uv: 5500 },
  { name: 'Jul', uv: 6100 },
];

const categoryData = [
  { name: 'Groceries', value: 31, color: '#6366f1' },
  { name: 'Shopping', value: 25, color: '#f59e0b' },
  { name: 'Dining', value: 22, color: '#10b981' },
  { name: 'Bills', value: 12, color: '#a855f7' },
  { name: 'Transport', value: 11, color: '#ef4444' },
];

const Dashboard = () => {
  const { isCollapsed } = useSidebar();
  
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
                data={data}
                margin={{
                  top: 20,
                  right: 20,
                  bottom: 5,
                  left: 0,
                }}
              >
                <CartesianGrid stroke="gray" strokeDasharray="1 2" />
                <Line type="monotone" dataKey="uv" stroke="blue" strokeWidth={2} name="amount" />
                <XAxis stroke='white' dataKey="name" />
                <YAxis stroke='white' width="auto" label={{ value: '', position: 'insideLeft', angle: -90 }} />
                <Tooltip labelStyle={{ color: 'black',  }} />
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
            {recentTrans.map(({ id, merchant, category, amount, date, status }) => (
              <tbody key={id}>
                <tr className='border-b'>
                  <td className='py-3 pl-3'>{merchant}</td>
                  <td className='py-3 '>{category}</td>
                  <td className='py-3 '>₹{amount}</td>
                  <td className='py-3 '>{date}</td>
                  <td className='py-3 '>{status}</td>
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
