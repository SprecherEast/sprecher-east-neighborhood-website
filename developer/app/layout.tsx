import type { Metadata } from 'next'
import React from 'react'

import { cn } from '@/platform/lib/cn'
import { NOT_INDEXED } from '@/platform/seo/notIndexed'
import { poppins, poppinsLatinExt } from '@/platform/theme/fonts'
import { InitTheme } from '@/platform/theme/InitTheme'
import { Providers } from '@/platform/theme/Providers'

// The site's stylesheet (./globals.css imports it): the theme tokens, the breakpoints and the kit's layout sizes, so the
// developer pages are styled by the same rules as the site, light and dark
import './globals.css'

/** The host also sends `X-Robots-Tag: noindex` (ops/caddy/developer-site.caddy); this is the page's own. */
export const metadata: Metadata = {
  title: {
    default: 'Sprecher East developer pages',
    template: '%s | Sprecher East developer pages',
  },
  robots: NOT_INDEXED,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      className={cn(poppins.variable, poppinsLatinExt.variable)}
      data-scroll-behavior="smooth"
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
      </head>
      <body>
        <Providers>
          <main id="main-content">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
