export const fmt = (n: number) =>
  `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const fmtCompact = (n: number) =>
  `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

// "14 Mar"
export const fmtDayMonth = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

// "01 Mar, 2024"
export const fmtFullDate = (d: Date | string) => {
  const date = new Date(d)
  return `${fmtDayMonth(date)}, ${date.getFullYear()}`
}

export type RangeKey = 'month' | '30d' | '3m' | '6m' | 'all'

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: '30d', label: 'Last 30 days' },
  { key: '3m', label: 'Last 3 months' },
  { key: '6m', label: 'Last 6 months' },
  { key: 'all', label: 'All time' },
]

// Start of the selected range, or null for "all time".
export const rangeStart = (key: RangeKey, now = new Date()): Date | null => {
  switch (key) {
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1)
    case '30d':   return new Date(now.getTime() - 30 * 86_400_000)
    case '3m':    return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    case '6m':    return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    case 'all':   return null
  }
}

// Filter transactions (newest first, as the backend returns them) to a range.
// previousSpend is debit total over the equal-length window just before it, for % change.
export const applyRange = <T extends { timestamp: string; type: string; amount: number }>(txList: T[], range: RangeKey) => {
  const now = new Date()
  const start = rangeStart(range, now)
  const filtered = start ? txList.filter(t => new Date(t.timestamp) >= start) : txList

  let rangeLabel = 'No transactions yet'
  if (start) {
    rangeLabel = `${fmtFullDate(start)} - ${fmtFullDate(now)}`
  } else if (txList.length) {
    rangeLabel = `${fmtFullDate(txList[txList.length - 1].timestamp)} - ${fmtFullDate(txList[0].timestamp)}`
  }

  let previousSpend: number | null = null
  if (start) {
    const prevStart = new Date(start.getTime() - (now.getTime() - start.getTime()))
    previousSpend = txList
      .filter(t => t.type === 'debit')
      .filter(t => { const d = new Date(t.timestamp); return d >= prevStart && d < start })
      .reduce((s, t) => s + t.amount, 0)
  }

  return { filtered, rangeLabel, previousSpend }
}

export const initials =(name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

const AVATAR_COLORS = ['#a78bfa', '#38bdf8', '#4ade80', '#f472b6', '#fbbf24', '#818cf8', '#f87171']

export const avatarColor = (name: string) => {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
