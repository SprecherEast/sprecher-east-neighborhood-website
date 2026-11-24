// What counts as a safety item (#1007). The definition is `safety.yaml`, written once; this file
// only reads it. The answer errs toward "safety": an item is clear only when verify and curate
// both said `safety: false` and no term of the definition appears in its text. Text from a source
// or a model can only add to the answer, never remove from it.

const TERM = /^[a-z]+( [a-z]+)*$/
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/** The text with width, accents, invisible marks, case and punctuation folded away. */
function foldText(text) {
  return String(text)
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[\p{M}\p{Cf}]/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** A word that mixes Latin letters with look-alike Cyrillic or Greek ones can't be read safely. */
const mixesScripts = (text) =>
  String(text)
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .some(
      (word) =>
        /\p{Script=Latin}/u.test(word) && /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(word),
    )

/** Compiles safety.yaml (already checked against schemas/safety.schema.json) into matchers. */
export function compileSafetyRules(definition) {
  const topics = (definition?.topics ?? []).map(({ id, terms }) => {
    for (const term of terms)
      if (!TERM.test(term)) throw new Error(`safety.yaml: bad term "${term}"`)
    const words = [...terms].sort((a, b) => b.length - a.length).join('|')
    return { id, pattern: new RegExp(`(?<![a-z0-9])(?:${words})(?:s|es|ed|d)?(?![a-z0-9])`) }
  })
  return { topics }
}

/** The text of an item that decides its class: the source's own words, then the draft's. */
function textsOf(item) {
  const { candidate, source, draft } = item
  const texts = [candidate.title, candidate.sourceText, candidate.locationText, candidate.sourceId]
  if (isObject(source)) texts.push(source.owner)
  if (draft !== undefined) {
    if (!isObject(draft)) return null
    texts.push(draft.title, draft.summary, draft.bodyMarkdown)
  }
  return texts.filter((text) => typeof text === 'string')
}

/**
 * Whether `item` is a safety item. Answers `{ safety, topics, why }`: `topics` are ids from the
 * definition and `why` fixed phrases, never the item's own words. Anything unreadable or missing
 * is safety.
 */
export function classifySafety(rules, item) {
  const why = []
  const topics = new Set()
  if (!isObject(item) || !isObject(item.candidate)) {
    return { safety: true, topics: [], why: ['the item can’t be read'] }
  }
  for (const [stage, section] of [
    ['verify', item.verification],
    ['curate', item.curation],
  ]) {
    if (!isObject(section) || section.safety === undefined || section.safety === null) {
      why.push(`${stage} gave no safety answer`)
    } else if (section.safety !== false) {
      why.push(
        section.safety === true
          ? `${stage} says safety`
          : `${stage}’s safety answer is not a boolean`,
      )
    }
  }
  const texts = textsOf(item)
  if (texts === null) why.push('the draft can’t be read')
  else {
    if (texts.some(mixesScripts)) why.push('a word mixes scripts')
    if (!rules || !Array.isArray(rules.topics)) why.push('the definition is missing')
    else {
      const folded = texts.map(foldText)
      for (const { id, pattern } of rules.topics) {
        if (folded.some((text) => pattern.test(text))) topics.add(id)
      }
    }
  }
  if (topics.size > 0) why.push(`the text matches ${[...topics].join(', ')}`)
  return { safety: why.length > 0, topics: [...topics], why }
}
