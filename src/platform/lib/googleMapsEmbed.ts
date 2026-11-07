/*
 * Which addresses the site may put in a map frame (#764). Only Google's own embed pages count: the
 * "Embed a map" address and a shared My Maps map. Neither needs a key or a billing account. The
 * keyed Embed API (`/maps/embed/v1/`) is refused so no key ever lands in the CMS or the page.
 */

const GOOGLE_MAPS_HOST = 'www.google.com'

/** `/maps/embed` (Embed a map) and `/maps/d/embed` or `/maps/d/u/0/embed` (My Maps) */
const EMBED_PATH = /^\/maps\/(?:embed|d\/(?:u\/\d+\/)?embed)\/?$/

/** The address an editor pasted: bare, or inside the iframe snippet Google's "Embed" tab shows */
function pastedAddress(value: string): string | null {
  const text = value.trim()
  if (!text.startsWith('<')) return text
  return /\ssrc\s*=\s*["']([^"']+)["']/i.exec(text)?.[1] ?? null
}

/**
 * The embed address to put in a frame, or `null` when the value isn't a Google map embed. The
 * CMS field and the page both use it, so a stored value that was never checked still can't
 * frame another site.
 */
export function toGoogleMapsEmbedUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const address = pastedAddress(value)
  if (!address) return null

  let url: URL
  try {
    url = new URL(address)
  } catch {
    return null
  }

  const isGoogleEmbed =
    url.protocol === 'https:' &&
    url.hostname === GOOGLE_MAPS_HOST &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    EMBED_PATH.test(url.pathname)
  return isGoogleEmbed ? url.toString() : null
}
