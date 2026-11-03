import { slugify } from 'payload/shared'

import type { RichTextValue } from '@/platform/lib'

/** A section heading in an article: its link address, words and level (#573) */
export type HeadingAnchor = { id: string; text: string; level: 2 | 3 }

type LexicalNode = {
  type?: string
  tag?: string
  text?: string
  children?: LexicalNode[]
}

const ANCHOR_TAGS = { h2: 2, h3: 3 } as const

const textOf = (node: LexicalNode): string =>
  node.type === 'text' ? (node.text ?? '') : (node.children ?? []).map(textOf).join('')

/** `Café & the "Big" Plan` → `cafe-the-big-plan`: accents folded to their letters, not dropped */
const toId = (text: string): string =>
  slugify(
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' '),
  )
    ?.replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '') || 'section'

/**
 * Every h2 and h3 of an article in reading order, with ids that are readable, unique (a repeat
 * gets `-2`, `-3`) and the same on every render. Headings inside editorial blocks render from their
 * own fields, not from this document, so they are not sections and get no anchor. The article's
 * renderer and its "On this page" menu both call this, so their ids always match.
 */
export function anchorsByNode(data: RichTextValue | null | undefined): Map<object, HeadingAnchor> {
  const anchors = new Map<object, HeadingAnchor>()
  const seen = new Map<string, number>()

  const walk = (node: LexicalNode) => {
    const level = node.type === 'heading' && node.tag ? ANCHOR_TAGS[node.tag as 'h2' | 'h3'] : null
    if (level) {
      const text = textOf(node).replace(/\s+/g, ' ').trim()
      if (text) {
        const base = toId(text)
        const count = (seen.get(base) ?? 0) + 1
        seen.set(base, count)
        anchors.set(node, { id: count === 1 ? base : `${base}-${count}`, text, level })
      }
    }
    node.children?.forEach(walk)
  }

  const root = (data as unknown as { root?: LexicalNode } | null | undefined)?.root
  if (root) walk(root)
  return anchors
}

export function headingAnchors(data: RichTextValue | null | undefined): HeadingAnchor[] {
  return [...anchorsByNode(data).values()]
}
