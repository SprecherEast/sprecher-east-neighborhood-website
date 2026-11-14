import { revealShift } from './revealShift'
import { REVEAL_PEEK_VAR } from './scrollMargin'

/** The attribute `Disclosure` sets when it names an anchor: the id of the element to keep visible */
export const REVEAL_ANCHOR_ATTR = 'data-reveal-anchor'

// How much of what follows the next summary row also shows, as a share of that row's height
const PAST_NEXT_ROW = 0.5

/** How long the box takes to expand, from its own style (`disclosure-expand`); 0 when it opens at once */
export function expansionMs(details: HTMLDetailsElement): number {
  try {
    const duration = getComputedStyle(details, '::details-content').transitionDuration
    const first = parseFloat(duration)
    if (!Number.isFinite(first)) return 0
    return Math.round(first * (duration.trim().split(',')[0]?.endsWith('ms') ? 1 : 1000))
  } catch {
    return 0
  }
}

/** The room to keep under an open box: none unless another box sits directly under it */
function roomForNext(details: HTMLDetailsElement): number {
  const next = details.nextElementSibling
  const row = next instanceof HTMLDetailsElement ? next.querySelector(':scope > summary') : null
  if (!row) return 0
  const { bottom, height } = row.getBoundingClientRect()
  return Math.round(bottom - details.getBoundingClientRect().bottom + height * PAST_NEXT_ROW)
}

/**
 * Scrolls the page to show a box that has just finished opening (#1152, #1178). With no anchor, the
 * browser does it (`block: 'nearest'`), measuring from the box's scroll margins: just far enough to
 * show its end, and a box taller than the screen stops with its own summary row at the top. With an
 * anchor named (`REVEAL_ANCHOR_ATTR`), the page scrolls as far as shows the end without the anchor
 * going above the sticky header (`revealShift`); the header's room is the box's own scroll margin.
 * A box with another directly under it keeps room for that one's summary row (#1154).
 */
export function revealOpened(details: HTMLDetailsElement): void {
  if (!details.open) return
  const room = roomForNext(details)
  if (room > 0) details.style.setProperty(REVEAL_PEEK_VAR, `${room}px`)
  else details.style.removeProperty(REVEAL_PEEK_VAR)

  const id = details.getAttribute(REVEAL_ANCHOR_ATTR)
  const anchor = id ? document.getElementById(id) : null
  if (!anchor) {
    details.scrollIntoView({ block: 'nearest' })
    return
  }
  const margins = getComputedStyle(details)
  const shift = revealShift({
    anchorTop: anchor.getBoundingClientRect().top,
    boxBottom:
      details.getBoundingClientRect().bottom + (parseFloat(margins.scrollMarginBottom) || 0),
    viewportHeight: window.innerHeight,
    offset: parseFloat(margins.scrollMarginTop) || 0,
  })
  if (shift !== 0) window.scrollBy({ top: shift })
}

/** `revealOpened`, once the box's expansion has ended (at once when it has none); a closed box is left alone */
export function revealAfterExpansion(details: HTMLDetailsElement): void {
  const wait = expansionMs(details)
  if (wait > 0) setTimeout(() => revealOpened(details), wait)
  else revealOpened(details)
}
