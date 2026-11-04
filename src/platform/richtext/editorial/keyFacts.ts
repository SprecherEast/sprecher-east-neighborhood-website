import type { ResolvedLink } from '@/platform/lib'
import type { KeyFactsBlock as StoredKeyFacts } from '@/payload-types'

import { isCertainty, type Certainty } from '@/platform/lib/certainty'
import { toEditorialLink } from './editorialLink'
import { isFactIcon, type FactIcon } from './factIcons'

/** One fact, as the key facts block draws it. */
export type KeyFact = {
  value: string
  label: string
  icon: FactIcon
  certainty: Certainty
  source: ResolvedLink | null
}

/** The key facts block's props: plain data (decision 0013). */
export type KeyFactsProps = {
  facts: KeyFact[]
}

/**
 * The stored block as the facts' props. A fact needs both a value and a label; an unknown icon
 * falls back to `info`, and an unknown certainty to `unknown` (the most cautious claim).
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
        icon: isFactIcon(fact.icon) ? fact.icon : 'info',
        certainty: isCertainty(fact.certainty) ? fact.certainty : 'unknown',
        source: toEditorialLink(fact.linkUrl, fact.linkLabel),
      },
    ]
  })
  return { facts }
}
