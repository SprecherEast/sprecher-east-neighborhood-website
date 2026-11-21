import Image from 'next/image'
import React from 'react'

/** The one height of every logo, so each gets the same space above and below in a button (#1375) */
export const LOGO_HEIGHT = 'h-8'

/**
 * The logos of the ways to sign in, each kept exactly as its owner supplies it (#1365). Brand rules
 * forbid recolouring, tinting, stretching, outlining or shading them, so a logo takes no colour,
 * filter or shadow from the theme: this is the one place where literal logo colours are allowed
 * (they live in the files, not in a class). Light and dark share the same files.
 *
 * - `google`: Google's own "G" in its standard colours, from its
 *   [branding guidelines](https://developers.google.com/identity/branding-guidelines).
 *
 * - `passkey`: the FIDO Alliance's passkey icon in its amber tile (the "B" mark, with a dark person
 *   and key), trimmed to the tile's own rounded corners with the white outside them made
 *   transparent (#1372): only a trim, so nothing in the mark is recoloured, stretched, outlined,
 *   shaded or rotated, and its corners blend into the page in light and dark alike. The tile has its
 *   own background, so one file serves both themes. It is 32 px tall (FIDO's guidelines set a
 *   minimum of 8 mm, about 30 CSS px). Its amber stays at least 3:1 against a
 *   dark page; against the light page it is about 2.3:1, with the dark person and key on amber far
 *   above that. The page shows its credit line (`accounts.passkey.iconCredit`).
 *
 * Both logos are `LOGO_HEIGHT` (32 px) tall with the width following, so in the kit's `lg` button
 * (48 px) each has the same 8 px above and below (#1375).
 *
 * The file is served as it is (`unoptimized`), so it is never re-encoded. The logo is decoration:
 * the button's words name it ("Continue with Google").
 */
const LOGOS = {
  google: { src: '/brand/google-g.png', width: 200, height: 204 },
  passkey: { src: '/brand/fido-passkey-icon-tile.png', width: 105, height: 106 },
} as const

export type Brand = keyof typeof LOGOS

export function BrandLogo({ brand }: { brand: Brand }) {
  const { src, width, height } = LOGOS[brand]
  return (
    <Image
      src={src}
      width={width}
      height={height}
      alt=""
      unoptimized
      // Height is set, width follows, so the proportions are never changed
      className={`${LOGO_HEIGHT} w-auto shrink-0`}
    />
  )
}
