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
 * - `passkey`: the FIDO Alliance's passkey icon in its amber tile (the "B" mark, with a dark person
 *   and key), trimmed to the tile's own rounded corners with the white outside them made
 *   transparent (#1372): only a trim, so nothing in the mark is recoloured, stretched, outlined,
 *   shaded or rotated, and its corners blend into the page in light and dark alike. The tile has its
 *   own background, so one file serves both themes. It is 32 px tall (FIDO's guidelines set a
 *   minimum of 8 mm, about 30 CSS px; the "G" is 20 px). Its amber stays at least 3:1 against a
 *   dark page; against the light page it is about 2.3:1, with the dark person and key on amber far
 *   above that. The page shows its credit line (`accounts.passkey.iconCredit`).
 *
 * Both logos sit in one slot, `LOGO_SLOT_HEIGHT` tall and centred, so they keep the same distance
 * from the button's top and bottom edges and the two buttons read as a pair at the same height
 * (the slot, 32 px, sits inside the button's 44 px, so the buttons stay equal). A mark smaller than
 * the slot, the "G", is centred in it.
 *
 * The file is served as it is (`unoptimized`), so it is never re-encoded. The logo is decoration:
 * the button's words name it ("Continue with Google").
 */
const LOGOS = {
  google: { src: '/brand/google-g.png', width: 200, height: 204, size: 'h-5' },
  passkey: { src: '/brand/fido-passkey-icon-tile.png', width: 105, height: 106, size: 'h-8' },
} as const

/** The one height both logos are seated in, so their space above and below is the same (#1372) */
export const LOGO_SLOT_HEIGHT = 'h-8'

export type Brand = keyof typeof LOGOS

export function BrandLogo({ brand }: { brand: Brand }) {
  const { src, width, height, size } = LOGOS[brand]
  return (
    <span className={`flex ${LOGO_SLOT_HEIGHT} shrink-0 items-center`}>
      <Image
        src={src}
        width={width}
        height={height}
        alt=""
        unoptimized
        // Height is set, width follows, so the proportions are never changed
        className={`${size} w-auto shrink-0`}
      />
    </span>
  )
}
