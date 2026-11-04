import type { ResolvedLink } from '@/platform/lib'
import type { KeyFactsBlock as StoredKeyFacts } from '@/payload-types'

import { isCertainty, type Certainty } from '@/platform/lib/certainty'
import { toEditorialLink } from './editorialLink'
import { isFactIcon, type FactIcon } from './factIcons'

/** One fact, as the key facts block draws it. */
export type KeyFact = {
  /** Where it stands, or the number: "Pending", "2040s" */
  value: string
  /** What the fact is about: "Who pays for the ramps" */
  label: string
  /** One plain sentence on why, shown under the value; `null` when the editor left it out */
  detail: string | null
  icon: FactIcon
  certainty: Certainty
  source: ResolvedLink | null
}

/** The key facts block's props: plain data (decision 0013). */
export type KeyFactsProps = {
  facts: KeyFact[]
}

/**
 * The stored block as the facts' props. A fact needs both a value and a label; the explanation is
 * optional, and a blank one is none. An unknown icon falls back to `info`, and an unknown
 * certainty to `unknown` (the most cautious claim).
 */
export function toKeyFactsProps(stored: Pick<StoredKeyFacts, 'facts'>): KeyFactsProps {
  const facts = (stored.facts ?? []).flatMap((fact): KeyFact[] => {
    const value = fact.value?.trim()
    const label = fact.label?.trim()
    if (!value || !label) return []
    return [
      {
        value,
        label,
        detail: fact.detail?.trim() || null,
        icon: isFactIcon(fact.icon) ? fact.icon : 'info',
        certainty: isCertainty(fact.certainty) ? fact.certainty : 'unknown',
        source: toEditorialLink(fact.linkUrl, fact.linkLabel),
      },
    ]
  })
  return { facts }
}
