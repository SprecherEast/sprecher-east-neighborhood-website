import { Poppins } from 'next/font/google'

/**
 * The site's body font, defined once (a Next.js "font definitions file"): the root layout imports it.
 * Its CSS variable is the one the theme's `font-sans` reads (`globals.css`). The component showcase is
 * built by Vite, which would point each viewer's browser at Google, so it serves the same family from
 * `.storybook/fonts.css`; change the weights or styles here and `.storybook/fonts.test.ts` fails until
 * that file follows.
 */
export const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-poppins',
  display: 'swap',
})
