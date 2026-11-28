// Test support for the developer site (#1459): the faces the site's theme names, read from the one place
// they live (the files in src/platform/theme/fonts/), and what a real showcase build carries of them.
import fs from 'node:fs'
import path from 'node:path'

import { OPS } from './umami-harness.mjs'

export const FONTS = path.join(OPS, '../src/platform/theme/fonts')

/** The site's face names, such as `poppins-latin-400-normal` (no extension). */
export const siteFaces = () =>
  fs
    .readdirSync(FONTS)
    .filter((name) => name.endsWith('.woff2'))
    .map((name) => name.slice(0, -'.woff2'.length))

/**
 * Puts into `showcase` what a Storybook build carries: its own Nunito Sans files (in the root and in
 * `sb-common-assets/`) and, unless `withSiteFont` is false, the site's faces as Vite names them in
 * `assets/` (`<face>-<hash>.woff2`).
 */
export function writeShowcaseFonts(showcase, { withSiteFont = true } = {}) {
  const put = (file) => {
    fs.mkdirSync(path.dirname(path.join(showcase, file)), { recursive: true })
    fs.writeFileSync(path.join(showcase, file), Buffer.from('wOF2\0\x01', 'latin1'))
  }
  for (const weight of ['regular', 'bold', 'italic', 'bold-italic']) {
    put(`nunito-sans-${weight}.woff2`)
    put(`sb-common-assets/nunito-sans-${weight}.woff2`)
  }
  if (withSiteFont) for (const face of siteFaces()) put(`assets/${face}-C8OXljZJ.woff2`)
}

/**
 * Puts into `pages` what the developer pages' export carries of the site's faces, as Next.js names a font it
 * copies into `_next/static/media/`: the face with underscores, then `-s.p.<hash>` (a preloaded face) or
 * `.<hash>` (the latin-ext faces, which are not preloaded). Unless `withSiteFont` is false.
 */
export function writePagesFonts(pages, { withSiteFont = true } = {}) {
  const media = path.join(pages, '_next/static/media')
  fs.mkdirSync(media, { recursive: true })
  if (!withSiteFont) return
  for (const face of siteFaces()) {
    const under = face.replaceAll('-', '_')
    const suffix = face.includes('latin-ext') ? '.3akwhu8439i8g' : '-s.p.14nztc_w4mkh_'
    fs.writeFileSync(
      path.join(media, `${under}${suffix}.woff2`),
      Buffer.from('wOF2\0\x01', 'latin1'),
    )
  }
}
