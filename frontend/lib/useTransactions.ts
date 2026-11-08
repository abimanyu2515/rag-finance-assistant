'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { Transaction } from '@/types/transaction'

// Latest transactions for the signed-in user (backend caps at 100, newest first)
export const useTransactions = () => {
  const { data: session } = useSession()
  const accessToken = (session as { accessToken?: string } | null)?.accessToken
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!accessToken) return
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/transactions`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await r.json()
      if (Array.isArray(data)) setTransactions(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the await
    refetch()
  }, [refetch])

  return { transactions, loading, refetch }
}
