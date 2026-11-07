import type { Metadata } from 'next'

import { cn } from '@/platform/lib/cn'
import { Poppins } from 'next/font/google'
import React from 'react'

import { AdminBar } from '@/platform/ui/AdminBar.client'
import { ThemeDecoration } from '@/platform/theme/ThemeDecoration'
import { JsonLd } from '@/platform/ui/JsonLd'
import { SiteFooter, SiteHeader } from '@/modules/site/server'
import { AccountMenu, AccountProvider } from '@/modules/accounts/server'
import { InitTheme } from '@/platform/theme/InitTheme'
import { Providers } from '@/platform/theme/Providers'
import { mergeOpenGraph } from '@/platform/seo/mergeOpenGraph'
import { organizationJsonLd } from '@/platform/seo/organizationJsonLd'
import { VersionCheck } from '@/platform/ui/VersionCheck.client'
import { draftMode } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/platform/lib/getURL'
import { Button } from '@/platform/ui'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-poppins',
  display: 'swap',
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()

  return (
    // data-scroll-behavior: Next keeps page changes instant while in-page jumps glide (#574)
    <html
      className={cn(poppins.variable)}
      data-scroll-behavior="smooth"
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        <JsonLd data={organizationJsonLd()} />
      </head>
      <body>
        <Providers>
          <Button
            href="#main-content"
            size="sm"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-60 focus:px-4"
          >
            Skip to content
          </Button>
          <AdminBar
            adminBarProps={{
              preview: isEnabled,
            }}
          />

          {/* The header shows who is signed in through the accounts module's menus (0008) */}
          <AccountProvider>
            <SiteHeader
              accountMenu={<AccountMenu variant="bar" />}
              mobileAccountMenu={<AccountMenu variant="drawer" />}
            />
          </AccountProvider>
          <main id="main-content">{children}</main>
          <SiteFooter />
          {/* The active theme's decorative layer, if it has one (#409) */}
          <ThemeDecoration />
          <VersionCheck />
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  title: {
    template: '%s — Sprecher East',
    default: 'Sprecher East — Neighborhood Association',
  },
  description:
    "Connecting neighbors on Madison's Far East Side. Community events, local news, and resources for the Sprecher East neighborhood.",
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
  },
}
