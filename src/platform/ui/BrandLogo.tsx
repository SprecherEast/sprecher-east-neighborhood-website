import Image from 'next/image'
import React from 'react'

import { cn } from '@/platform/lib/cn'

/**
 * The logos of the ways to sign in, each kept exactly as its owner supplies it (#1365). Brand rules
 * forbid recolouring, tinting, stretching, outlining or shading them, so a logo takes no colour,
 * filter or shadow from the theme: this is the one place where literal logo colours are allowed
 * (they live in the files, not in a class). Light and dark share the same files.
 *
 * - `google`: Google's own "G" in its standard colours, from its
 *   [branding guidelines](https://developers.google.com/identity/branding-guidelines).
 *
 * The file is served as it is (`unoptimized`), so it is never re-encoded. The logo is decoration:
 * the button's words name it ("Continue with Google").
 */
const LOGOS = {
  google: { src: '/brand/google-g.png', width: 200, height: 204 },
} as const

export type Brand = keyof typeof LOGOS

export function BrandLogo({ brand, className }: { brand: Brand; className?: string }) {
  const { src, width, height } = LOGOS[brand]
  return (
    <Image
      src={src}
      width={width}
      height={height}
      alt=""
      unoptimized
      // Height is set, width follows, so the proportions are never changed
      className={cn('h-5 w-auto shrink-0', className)}
    />
  )
}
