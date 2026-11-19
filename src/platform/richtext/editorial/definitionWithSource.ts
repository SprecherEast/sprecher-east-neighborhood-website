import type { ResolvedLink } from '@/platform/lib'

/** A stretch of a tab's definition: plain text, or the source's link text made into the link */
export type DefinitionPart = { kind: 'text'; text: string } | { kind: 'link'; link: ResolvedLink }

/**
 * Weaves a tab's source into its definition (#980): the first mention of the source's link text
 * becomes the link, so the tab needs no separate "Source:" line. The link keeps the definition's own
 * spelling of the words. Returns null when there is no source or the definition never says its link
 * text, and the caller then shows the source line as before, so a source is never lost.
 */
export function splitDefinitionAtSource(
  definition: string,
  source: ResolvedLink | null,
): DefinitionPart[] | null {
  const label = source?.label.trim()
  if (!source || !label) return null

  const start = definition.toLowerCase().indexOf(label.toLowerCase())
  if (start === -1) return null

  const end = start + label.length
  const before = definition.slice(0, start)
  const after = definition.slice(end)
  return [
    ...(before ? [{ kind: 'text', text: before } as const] : []),
    { kind: 'link', link: { ...source, label: definition.slice(start, end) } },
    ...(after ? [{ kind: 'text', text: after } as const] : []),
  ]
}
