import type { RichTextValue } from '@/platform/lib'
import { anchorId } from '@/platform/lib/anchorId'

import { lexicalRoot, type LexicalNode } from './lexicalTree'

/** A section heading in an article: its link address, words and level (#573) */
export type HeadingAnchor = { id: string; text: string; level: 2 | 3 }

const ANCHOR_TAGS = { h2: 2, h3: 3 } as const

// A line break inside a heading separates words, so it counts as a space
const textOf = (node: LexicalNode): string =>
  node.type === 'linebreak'
    ? ' '
    : node.type === 'text'
      ? (node.text ?? '')
      : (node.children ?? []).map(textOf).join('')

/**
 * Every h2 and h3 of an article in reading order, with ids that are readable, unique (a repeat
 * gets `-2`, `-3`) and the same on every render. Headings inside editorial blocks render from their
 * own fields, not from this document, so they are not sections and get no anchor. The article's
 * renderer and its "On this page" menu both call this, so their ids always match.
 */
export function anchorsByNode(data: RichTextValue | null | undefined): Map<object, HeadingAnchor> {
  const anchors = new Map<object, HeadingAnchor>()
  const used = new Set<string>()
  const counts = new Map<string, number>()

  const walk = (node: LexicalNode) => {
    const level = node.type === 'heading' && node.tag ? ANCHOR_TAGS[node.tag as 'h2' | 'h3'] : null
    if (level) {
      const text = textOf(node).replace(/\s+/g, ' ').trim()
      if (text) {
        const base = anchorId(text)
        // A repeat gets -2, -3; skip any number another heading already took ("Costs 2")
        let id = base
        let count = counts.get(base) ?? 1
        while (used.has(id)) id = `${base}-${++count}`
        counts.set(base, count)
        used.add(id)
        anchors.set(node, { id, text, level })
      }
    }
    node.children?.forEach(walk)
  }

  const root = lexicalRoot(data)
  if (root) walk(root)
  return anchors
}

export function headingAnchors(data: RichTextValue | null | undefined): HeadingAnchor[] {
  return [...anchorsByNode(data).values()]
}
