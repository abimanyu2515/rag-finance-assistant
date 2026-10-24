'use client'

import { CalendarDays } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RANGES, type RangeKey } from '@/lib/dashboard'

type Props = {
  value: RangeKey
  onChange: (value: RangeKey) => void
  label: string
}

const RangeSelect = ({ value, onChange, label }: Props) => {
  return (
    <div className='flex items-center gap-4'>
      <span className='text-sm text-ink-muted'>Showing data:</span>
      <DropdownMenu>
        <DropdownMenuTrigger className='flex items-center gap-4 bg-panel border border-line hover:border-line-strong rounded-lg px-4 py-2.5 text-sm cursor-pointer transition-colors'>
          {label}
          <CalendarDays size={18} className='text-ink-muted' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='bg-panel border-line text-ink'>
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as RangeKey)}>
            {RANGES.map(r => (
              <DropdownMenuRadioItem key={r.key} value={r.key} className='focus:bg-control focus:text-ink'>
                {r.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default RangeSelect
