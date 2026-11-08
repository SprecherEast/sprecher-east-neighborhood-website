import type { LayoutWidth } from '../domain/blocks'

/**
 * A column's or item's width on the 12-column grid: the whole row on a phone, the chosen share
 * from `lg` up. One definition for the content block's columns and the section's items (#884).
 */
export const COLUMN_SPAN: Record<LayoutWidth, string> = {
  full: 'col-span-4 lg:col-span-12',
  threeQuarters: 'col-span-4 lg:col-span-9',
  twoThirds: 'col-span-4 lg:col-span-8',
  half: 'col-span-4 lg:col-span-6',
  oneThird: 'col-span-4 lg:col-span-4',
  quarter: 'col-span-4 lg:col-span-3',
}
