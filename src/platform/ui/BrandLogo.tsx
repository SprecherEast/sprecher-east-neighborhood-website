import Image from 'next/image'
import React from 'react'

/**
 * The logos of the ways to sign in, each kept exactly as its owner supplies it (#1365). Brand rules
 * forbid recolouring, tinting, stretching, outlining or shading them, so a logo takes no colour,
 * filter or shadow from the theme: this is the one place where literal logo colours are allowed
 * (they live in the files, not in a class). Light and dark share the same files.
 *
 * - `google`: Google's own "G" in its standard colours, from its
 *   [branding guidelines](https://developers.google.com/identity/branding-guidelines).
 *
 * - `passkey`: the FIDO Alliance's passkey icon, as it supplies it: a black person and an amber key
 *   on its own opaque white square. It is shown 32 px tall (FIDO's guidelines set a minimum of
 *   8 mm, about 29 CSS px; the "G" is 20 px), never cropped, rounded, recoloured or stretched, in
 *   light and dark alike. Both sizes sit inside the button's 44 px, so the buttons stay equal. FIDO's rules ask for 3:1
 *   contrast and free space around the icon; the white square holds both, and the file's own white
 *   margin is the free space. The page shows its credit line (`accounts.passkey.iconCredit`).
 *
 * The file is served as it is (`unoptimized`), so it is never re-encoded. The logo is decoration:
 * the button's words name it ("Continue with Google").
 */
const LOGOS = {
  google: { src: '/brand/google-g.png', width: 200, height: 204, size: 'h-5' },
  passkey: { src: '/brand/fido-passkey-icon.png', width: 150, height: 150, size: 'h-8' },
} as const

export type Brand = keyof typeof LOGOS

export function BrandLogo({ brand }: { brand: Brand }) {
  const { src, width, height, size } = LOGOS[brand]
  return (
    <Image
      src={src}
      width={width}
      height={height}
      alt=""
      unoptimized
      // Height is set, width follows, so the proportions are never changed
      className={`${size} w-auto shrink-0`}
    />
  )
}
