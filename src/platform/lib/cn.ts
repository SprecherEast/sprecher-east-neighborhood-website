import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/*
 * `bg-hatch` (the diagonal stripes, tailwind.css) is a background image, so it sits beside a
 * `bg-chart-2` colour instead of replacing it (#662). `text-fine` (the theme's finest text size)
 * is a size, so it sits beside a text colour and replaces another size.
 */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'bg-image': ['bg-hatch'], 'font-size': ['text-fine'] } },
})

/** Joins class names, and lets a later Tailwind class win over an earlier one it conflicts with. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
