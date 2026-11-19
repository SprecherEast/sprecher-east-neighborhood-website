/**
 * How far to scroll the page after a row has expanded, so as much of its end shows as fits without
 * the row's anchor (the element that must stay visible, such as the heading of the card the row is
 * in) going above the sticky header (#1178). Positive scrolls down, negative up, 0 moves nothing.
 *
 * All values are viewport pixels: `anchorTop` is the anchor's top edge, `boxBottom` the row's bottom
 * edge plus the gap to keep under it, `offset` the room the sticky header takes at the top. The
 * anchor wins when both cannot show, and it is brought back when it already sits under the header.
 */
export function revealShift({
  anchorTop,
  boxBottom,
  viewportHeight,
  offset,
}: {
  anchorTop: number
  boxBottom: number
  viewportHeight: number
  offset: number
}): number {
  const toShowEnd = Math.max(0, boxBottom - viewportHeight)
  const toKeepAnchor = anchorTop - offset
  return Math.round(Math.min(toShowEnd, toKeepAnchor))
}
