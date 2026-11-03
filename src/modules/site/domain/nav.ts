/** One link in the header's nav: where it goes, what it says, and whether it leaves the site. */
export type HeaderNavLink = { href: string; label: string; external: boolean }

/** The path of an address, without its query, fragment or trailing slashes (`/` stays `/`). */
export function toPathname(value: string): string {
  const [pathOnly] = value.split(/[?#]/)
  if (!pathOnly) return ''
  if (pathOnly === '/') return '/'
  return pathOnly.replace(/\/+$/, '')
}

/** True when a nav link to `href` is for the page at `pathname` or the section it is in. */
export function isActivePath(pathname: string, href: string): boolean {
  const current = toPathname(pathname)
  const target = toPathname(href)
  if (!target || !target.startsWith('/')) return false
  return current === target || (target !== '/' && current.startsWith(target + '/'))
}

// The header always shows a Contact button, so a CMS "Contact" nav item would appear twice.
const HEADER_BUTTON_PATHS = new Set(['/contact'])

/** True for a page the header links to with its own button, so the nav leaves it out. */
export function isHeaderButtonPath(href: string): boolean {
  return HEADER_BUTTON_PATHS.has(toPathname(href))
}
