import { Poppins } from 'next/font/google'

/**
 * The site's body font, defined once (a Next.js "font definitions file"): the root layout and the
 * component showcase (`.storybook/preview.tsx`) both import it. Its CSS variable is the one the
 * theme's `font-sans` reads (`globals.css`).
 */
export const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-poppins',
  display: 'swap',
})
