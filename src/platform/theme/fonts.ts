import localFont from 'next/font/local'

/**
 * The site's body font, defined once (a Next.js "font definitions file"): the root layout imports it. The
 * files are Poppins' latin subset (SIL OFL 1.1, licence in `fonts/OFL.txt`), kept in `fonts/` and served by
 * Next.js from the site itself. Its CSS variable is the one the theme's `font-sans` reads (`globals.css`).
 * The component showcase is built by Vite, not Next.js, so `.storybook/fonts.css` declares the same faces
 * over the same files; add or drop a face here and `.storybook/fonts.test.ts` fails until that file follows.
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
