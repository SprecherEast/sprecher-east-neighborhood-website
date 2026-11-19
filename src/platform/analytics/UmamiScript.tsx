import Script from 'next/script'

import { getServerSideURL } from '@/platform/lib/getURL'

import { umamiConfig } from './umami'

/**
 * Counts visits with the site's own Umami: no cookies, no personal details, and nothing when the
 * browser sends Do Not Track. The page address is sent without its query string
 * (`data-exclude-search`), because reset and verification tokens, a sign-up email and search words
 * travel there. The script loads after the page is usable, so it adds nothing to
 * the first view. Only the public layout draws it, never the admin (#950).
 * Docs: https://docs.umami.is/docs/tracker-configuration
 */
export function UmamiScript() {
  const config = umamiConfig(process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID, getServerSideURL())
  if (!config) return null

  return (
    <Script
      src={config.src}
      strategy="afterInteractive"
      defer
      data-website-id={config.websiteId}
      data-domains={config.domains}
      data-do-not-track="true"
      data-exclude-search="true"
    />
  )
}
