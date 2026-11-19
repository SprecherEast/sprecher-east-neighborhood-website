/**
 * Where the visit counter lives and which site it counts for (#950).
 *
 * Umami runs at `stats.<domain>` (ops/install-umami.sh). The site's ID comes from
 * `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, fixed at build time (next.config.js); with no ID, or an address
 * that has no real domain (localhost, an IP), nothing is counted.
 */

export type UmamiConfig = {
  /** The tracking script's address */
  src: string
  websiteId: string
  /** The hostnames that may count visits, comma-separated: the tracker stays quiet on any other */
  domains: string
}

const WEBSITE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function umamiConfig(websiteId: string | undefined, serverUrl: string): UmamiConfig | null {
  const id = websiteId?.trim()
  if (!id || !WEBSITE_ID.test(id)) return null

  let hostname: string
  try {
    hostname = new URL(serverUrl).hostname
  } catch {
    return null
  }
  const domain = hostname.replace(/^www\./, '')
  // A name with letters and a dot: not localhost, not an IPv4 or IPv6 address
  if (!/^(?:[a-z0-9-]+\.)+[a-z][a-z0-9-]*$/i.test(domain)) return null

  // The address as configured and the bare domain, so a www address still counts
  const domains = [...new Set([hostname, domain])].join(',')

  return { src: `https://stats.${domain}/script.js`, websiteId: id, domains }
}
