import { slugify } from 'payload/shared'

import { CHART_LIMITS } from '@/platform/lib/chart/spec'

/** The text without surrounding space, or undefined when nothing is left */
export const blank = (text: string | null | undefined) => text?.trim() || undefined

/** A part's key from its label ("Police dept." is `police-dept`): the site's slug, accents folded */
const keyFromLabel = (label: string): string =>
  slugify(label.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    ?.replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, CHART_LIMITS.key)
    .replace(/-$/, '') || 'part'

/**
 * Each item's key: the one typed (kept exactly: a key typed twice is for the spec to refuse, not
 * for us to rename), or made from its label, where a repeat gets `-2`, `-3`... within the limit.
 */
export function keysOf(items: readonly { key?: string | null; label?: string | null }[]): string[] {
  const typed = items.map((item) => blank(item.key))
  const used = new Set(typed.filter((key): key is string => key !== undefined))
  return items.map((item, i) => {
    const given = typed[i]
    if (given !== undefined) return given
    const base = keyFromLabel(item.label ?? '')
    let key = base
    for (let n = 2; used.has(key); n++) {
      const suffix = `-${n}`
      key = base.slice(0, CHART_LIMITS.key - suffix.length).replace(/-$/, '') + suffix
    }
    used.add(key)
    return key
  })
}
