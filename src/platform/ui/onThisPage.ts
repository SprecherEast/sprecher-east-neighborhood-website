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
