import { anchorId } from '@/platform/lib/anchorId'

/**
 * The name of each tab in its link (#1097): its label as a readable address part, with a `tab-`
 * prefix so it never equals a heading's id on the page, and `-2`, `-3` for a repeat so every tab
 * has a link of its own. The same on every render.
 */
export function tabAnchors(labels: string[]): string[] {
  const counts = new Map<string, number>()
  return labels.map((label) => {
    const base = `tab-${anchorId(label)}`
    const count = (counts.get(base) ?? 0) + 1
    counts.set(base, count)
    return count === 1 ? base : `${base}-${count}`
  })
}
