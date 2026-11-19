/**
 * A cautious "a person likely used this" signal for Umami (#975): one click listener for the whole
 * page, so no component changes. Page views include robots; a real click on a button or on a link
 * that leaves the site says more. It is "likely human, not certain" wherever it is shown.
 *
 * Counted: a click the browser made for a person (`isTrusted`), on a button or an outbound web
 * link, once per button or link per visit, from a browser that isn't automated and doesn't send
 * Do Not Track. Umami's own known-robot filter still applies on its side. The visit's memory is a
 * plain set in the page: no cookie, no storage, no identifier. The event carries the button's
 * label or the other site's host, never an address with a path or query.
 */

export const LIKELY_HUMAN_EVENT = 'likely-human-click'

const MAX_LABEL = 60

type Counter = { track?: (name: string, data?: Record<string, string>) => void }

/** The tracker puts `umami` on the window once its script has loaded */
const counterOf = (win: Window) => (win as Window & { umami?: Counter }).umami

const bare = (hostname: string) => hostname.replace(/^www\./, '')

/** True for an http(s) address on another site; `www.` makes no difference */
export function isOutboundLink(url: URL, hostname: string): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  return bare(url.hostname) !== bare(hostname)
}

/** Same reading of the browser's setting as Umami's own tracker */
function doNotTrack(win: Window): boolean {
  const nav = win.navigator as Navigator & { msDoNotTrack?: string | null }
  const setting = nav.doNotTrack || (win as Window & { doNotTrack?: string }).doNotTrack
  return [setting, nav.msDoNotTrack].some((value) => value === '1' || value === 'yes')
}

function isHeadless(win: Window): boolean {
  return win.navigator.webdriver === true || /headless/i.test(win.navigator.userAgent)
}

function labelOf(button: HTMLElement): string {
  const label = button.getAttribute('aria-label') || button.textContent || ''
  return label.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL)
}

type Click = { kind: 'button' | 'outbound-link'; target: string }

function describe(start: Element, win: Window): Click | null {
  const button = start.closest<HTMLElement>('button, [role="button"]')
  if (button) {
    if (button.matches(':disabled, [aria-disabled="true"]')) return null
    return { kind: 'button', target: labelOf(button) }
  }

  const link = start.closest<HTMLAnchorElement>('a[href]')
  if (!link) return null
  let url: URL
  try {
    url = new URL(link.href, win.location.href)
  } catch {
    return null
  }
  return isOutboundLink(url, win.location.hostname)
    ? { kind: 'outbound-link', target: url.hostname }
    : null
}

/**
 * Starts listening; the returned function stops it. `isPerson` is the real browser's own flag by
 * default; a test passes its own, because jsdom can't make a click the browser calls trusted.
 */
export function startLikelyHumanClicks(
  doc: Document,
  win: Window,
  isPerson: (event: Event) => boolean = (event) => event.isTrusted,
): () => void {
  const seen = new Set<string>()

  const onClick = (event: MouseEvent) => {
    if (!isPerson(event) || !(event.target instanceof Element)) return
    const track = counterOf(win)?.track
    if (!track || doNotTrack(win) || isHeadless(win)) return

    const click = describe(event.target, win)
    if (!click) return

    const key = `${click.kind}:${click.target}`
    if (seen.has(key)) return
    seen.add(key)
    track(LIKELY_HUMAN_EVENT, click)
  }

  // Capture, so a handler that stops the click from bubbling doesn't hide it
  doc.addEventListener('click', onClick, true)
  return () => doc.removeEventListener('click', onClick, true)
}
