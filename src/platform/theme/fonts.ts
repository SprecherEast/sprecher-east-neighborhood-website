import localFont from 'next/font/local'

/**
 * The site's body font, defined once (a Next.js "font definitions file"): the root layout imports it. The
 * files are Poppins' latin and latin-ext subsets (SIL OFL 1.1, licence in `fonts/OFL.txt`), kept in `fonts/`
 * and served by Next.js from the site itself. The CSS variables are the ones the theme's `font-sans` reads
 * (`globals.css`), latin-ext first (see below). The component showcase is built by Vite, not Next.js, so
 * `.storybook/fonts.css` declares the same faces over the same files; add or drop a face here and
 * `.storybook/fonts.test.ts` fails until that file follows.
 *
 * Devanagari is left out on purpose: the site is written in the Latin script, and a page in another script
 * gets its system font for the whole script, which is how any font without it behaves, where a missing
 * latin-ext letter would change font in the middle of a word.
 */
export const poppins = localFont({
  src: [
    { path: './fonts/poppins-latin-300-normal.woff2', weight: '300', style: 'normal' },
    { path: './fonts/poppins-latin-300-italic.woff2', weight: '300', style: 'italic' },
    { path: './fonts/poppins-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/poppins-latin-400-italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/poppins-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/poppins-latin-500-italic.woff2', weight: '500', style: 'italic' },
    { path: './fonts/poppins-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/poppins-latin-600-italic.woff2', weight: '600', style: 'italic' },
    { path: './fonts/poppins-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/poppins-latin-700-italic.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-poppins',
  display: 'swap',
})

/**
 * Letters outside the latin subset that names carry (Polish, Czech, Turkish, Romanian, Vietnamese…). Not
 * preloaded, and limited by `unicode-range`, so a page without such a letter never fetches these files.
 * It sits BEFORE `poppins` in `font-sans`: next/font puts its Arial fallback inside `--font-poppins`, so with
 * latin first a letter the latin file lacks (Ł, ő, Ş) would fall to Arial, wherever Arial is installed, and
 * this file would never be fetched. The `unicode-range` leaves out every latin letter and the space, so latin
 * text skips this family and its line metrics are unchanged.
 */
export const poppinsLatinExt = localFont({
  src: [
    { path: './fonts/poppins-latin-ext-300-normal.woff2', weight: '300', style: 'normal' },
    { path: './fonts/poppins-latin-ext-300-italic.woff2', weight: '300', style: 'italic' },
    { path: './fonts/poppins-latin-ext-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/poppins-latin-ext-400-italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/poppins-latin-ext-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/poppins-latin-ext-500-italic.woff2', weight: '500', style: 'italic' },
    { path: './fonts/poppins-latin-ext-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/poppins-latin-ext-600-italic.woff2', weight: '600', style: 'italic' },
    { path: './fonts/poppins-latin-ext-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/poppins-latin-ext-700-italic.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-poppins-ext',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    },
  ],
})
