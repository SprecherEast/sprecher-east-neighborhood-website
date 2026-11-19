import type { KeyFactsBlock } from '@/payload-types'

/*
 * Key facts as the editor stores them, for the gallery, the tests and the alignment page: the
 * cases most likely to knock cards in a row out of line (#678). One title wraps beside titles that
 * don't, one fact has no explanation, one has a source link, and one has a title and an
 * explanation at the editor's longest.
 */

type StoredFact = NonNullable<KeyFactsBlock['facts']>[number]

const fact = (
  label: string,
  value: string,
  detail: string | null,
  icon: StoredFact['icon'],
  link?: string,
): StoredFact => ({
  label,
  value,
  detail,
  icon,
  certainty: 'confirmed',
  ...(link ? { linkLabel: link, linkUrl: 'https://example.com' } : {}),
})

export const SHORT_FACT = fact(
  'Corridor plan',
  'Decided',
  'WisDOT chose the overall plan in Dec 2024.',
  'government',
  'WisDOT decision',
)
export const WRAPPING_FACT = fact(
  'Who pays for the ramps',
  'Pending',
  'The City and State have not yet agreed on who pays.',
  'money',
  'WisDOT project page',
)
export const NO_DETAIL_FACT = fact('Next public meeting', 'Nov 10', null, 'date')
export const LONGEST_FACT: StoredFact = {
  ...fact(
    'Total cost of the whole project including each phase, in all',
    '$10M',
    'No price has been published, so this is the City’s earlier share, not the ramps’ cost.',
    'money',
  ),
  certainty: 'unknown',
}

/** The three cards of "The short version" that came out uneven: the middle title wraps */
export const UNEVEN_FACTS = [SHORT_FACT, WRAPPING_FACT, NO_DETAIL_FACT]
