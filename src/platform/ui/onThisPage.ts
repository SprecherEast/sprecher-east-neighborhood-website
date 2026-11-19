/** A section of an article: the link address of its heading, its words and its level (#574) */
export type OnThisPageSection = { id: string; text: string; level: 2 | 3 }

/** An article needs this many sections before a menu is worth showing */
export const MIN_SECTIONS = 3

/** Whether the "On this page" menu has anything worth showing for these sections */
export const hasOnThisPage = (sections: readonly OnThisPageSection[]): boolean =>
  sections.length >= MIN_SECTIONS

/**
 * The section being read: the last heading whose top is at or above the reading line, in page
 * order. Null before the first heading reaches it.
 */
export function currentSectionId(
  headings: readonly { id: string; top: number }[],
  readingLine: number,
): string | null {
  let current: string | null = null
  for (const heading of headings) {
    if (heading.top <= readingLine) current = heading.id
  }
  return current
}

/**
 * A heading counts as "being read" this far (px) below where a jump to it lands. It is the
 * `1.5rem` of room in `--anchor-offset` (globals.css), rounded down, so the heading a click lands
 * on is always the highlighted one.
 */
const READING_SLACK = 16

/**
 * The reading line, in px from the top of the window: where a jump lands (the heading's computed
 * `scroll-margin-top`) plus a little slack. Every heading carries `SECTION_SCROLL_MARGIN`, so the
 * first heading's margin stands for them all.
 */
export function readingLine(scrollMarginTop: string): number {
  const margin = parseFloat(scrollMarginTop)
  return (Number.isNaN(margin) ? 0 : margin) + READING_SLACK
}
