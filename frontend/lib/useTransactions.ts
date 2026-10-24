'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { Transaction } from '@/types/transaction'

// Latest transactions for the signed-in user (backend caps at 100, newest first)
export const useTransactions = () => {
  const { data: session } = useSession()
  const accessToken = (session as { accessToken?: string } | null)?.accessToken
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accessToken) return
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/transactions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? setTransactions(data) : null)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [accessToken])

  return { transactions, loading }
}
