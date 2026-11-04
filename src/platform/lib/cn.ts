import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/*
 * `bg-hatch` (the diagonal stripes, tailwind.css) is a background image, so it sits beside a
 * `bg-chart-2` colour instead of replacing it (#662).
 */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'bg-image': ['bg-hatch'] } },
})

/** Joins class names, and lets a later Tailwind class win over an earlier one it conflicts with. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
