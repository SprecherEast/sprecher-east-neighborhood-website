import { cn } from '@/platform/lib/cn'
import type { ReactNode } from 'react'

/**
 * The buttons of one decision side by side, stacked on a phone: the same gap, the same order
 * and the same break everywhere (the account offers, the passkey list and the connection
 * approval). `align="end"` puts them at the right from the wider layout up, as a dialog's do.
 */
export function ButtonRow({
  align = 'start',
  children,
}: {
  align?: 'start' | 'end'
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row', align === 'end' && 'sm:justify-end')}>
      {children}
    </div>
  )
}
