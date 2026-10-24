'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import PageShell from '@/components/PageShell'
import BalanceSummaryCard from '@/components/dashboard/BalanceSummaryCard'
import SpendingCard from '@/components/dashboard/SpendingCard'
import FraudAlertsCard from '@/components/dashboard/FraudAlertsCard'
import RecentTransactionsCard from '@/components/dashboard/RecentTransactionsCard'
import SavingsCard from '@/components/dashboard/SavingsCard'
import AssistantPromoCard from '@/components/dashboard/AssistantPromoCard'
import RangeSelect from '@/components/dashboard/RangeSelect'
import { type RangeKey, applyRange } from '@/lib/dashboard'
import { useTransactions } from '@/lib/useTransactions'

const Dashboard = () => {
  const { data: session } = useSession()
  const { transactions: txList } = useTransactions()
  const [range, setRange] = useState<RangeKey>('all')

  const { filtered, rangeLabel, previousSpend } = useMemo(() => applyRange(txList, range), [txList, range])

  const firstName = session?.user?.name?.split(' ')[0]
  const byDay = range === 'month' || range === '30d'

  return (
    <PageShell title='Dashboard'>
      <div className='flex flex-wrap items-center justify-between gap-4 mb-8'>
        <p className='text-sm text-ink-muted'>
          Hello{firstName ? ` ${firstName}` : ''}, let&apos;s look at your financial data:
        </p>
        <RangeSelect value={range} onChange={setRange} label={rangeLabel} />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'>
        <BalanceSummaryCard transactions={filtered} rangeLabel={rangeLabel} byDay={byDay} />
        <SpendingCard transactions={filtered} rangeLabel={rangeLabel} previousSpend={previousSpend} />
        <FraudAlertsCard transactions={filtered} />

        <RecentTransactionsCard transactions={filtered} rangeLabel={rangeLabel} className='md:col-span-2' />
        <div className='flex flex-col gap-6 md:col-span-2 xl:col-span-1'>
          <SavingsCard transactions={filtered} />
          <AssistantPromoCard />
        </div>
      </div>
    </PageShell>
  )
}

export default Dashboard
