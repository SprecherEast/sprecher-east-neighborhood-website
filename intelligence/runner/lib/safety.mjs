// What counts as a safety item (#1007). The definition is `safety.yaml`, written once; this file
// only reads it. The answer errs toward "safety": an item is clear only when verify and curate
// both said `safety: false`, its source isn't a safety source, and no term of the definition
// appears in any text of the item. Text from a source or a model can only add to the answer,
// never remove from it.

export const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

// What is read: depth, the number of strings, and their size are bounded; an item that goes past
// a bound can't be read in full, so it counts as safety.
const MAX_DEPTH = 8
const MAX_STRINGS = 400
const MAX_CHARS = 200_000
// A term this long (letters only) is also looked for with the spaces taken out of the text
const SQUASH_FROM = 6

/** The scripts a word may not mix (look-alike letters hide a term); any two of them are unreadable. */
const SCRIPTS = [
  'Latin',
  'Cyrillic',
  'Greek',
  'Armenian',
  'Cherokee',
  'Georgian',
  'Coptic',
  'Hebrew',
  'Arabic',
  'Thai',
  'Devanagari',
  'Han',
  'Hiragana',
  'Katakana',
  'Hangul',
].map((name) => new RegExp(`\\p{Script=${name}}`, 'u'))

/** Letters that only fill space, which a reader doesn't see. */
const FILLERS = /[ᅟᅠㅤﾠ\p{M}\p{Cf}]/gu

/** The text with width, accents, invisible marks, case and punctuation folded away. */
function foldText(text) {
  return text
    .normalize('NFKC')
    .normalize('NFD')
    .replace(FILLERS, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** A word that mixes scripts can't be read safely: look-alike letters could spell a term. */
const mixesScripts = (text) =>
  text
    .normalize('NFKC')
    .replace(/\p{Cf}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .some((word) => SCRIPTS.filter((script) => script.test(word)).length > 1)

const LEET = { 0: 'o', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' }

/** The text as a reader would see it with digits and symbols standing for letters ("p0l1ce"). */
function unLeet(text, one) {
  const map = { ...LEET, 1: one }
  return text.replace(/[\p{L}0-9@$]+/gu, (word) =>
    /\p{L}/u.test(word) && /[0-9@$]/u.test(word)
      ? word.replace(/[0-9@$]/g, (c) => map[c] ?? c)
      : word,
  )
}

/** Runs of single letters ("p o l i c e", "p-o-l-i-c-e") joined into one word. */
const joinLetters = (folded) =>
  folded.replace(/\b(?:\p{L} ){2,}\p{L}\b/gu, (run) => run.replaceAll(' ', ''))

/** Every form of the text a term could be matched against, as folded strings. */
function views(text) {
  const lowered = text.normalize('NFKC').toLowerCase()
  return [lowered, unLeet(lowered, 'i'), unLeet(lowered, 'l')].flatMap((view) => {
    const folded = foldText(view)
    const squashed = folded.replaceAll(' ', '')
    return [
      { folded, squashed },
      { folded: joinLetters(folded), squashed },
    ]
  })
}

const escape = (term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A term with the endings a word takes: s, es, ed, d, ing, and -y as -ies or -ied. */
function forms(term) {
  const at = term.lastIndexOf(' ') + 1
  const head = term.slice(0, at)
  const word = term.slice(at)
  const endings = new Set([word, `${word}s`, `${word}es`, `${word}ed`, `${word}d`])
  endings.add(word.endsWith('e') ? `${word.slice(0, -1)}ing` : `${word}ing`)
  if (word.endsWith('y')) {
    endings.add(`${word.slice(0, -1)}ies`)
    endings.add(`${word.slice(0, -1)}ied`)
  }
  return [...endings].map((ending) => `${head}${ending}`)
}

/** Compiles safety.yaml (already checked against schemas/safety.schema.json) into matchers. */
export function compileSafetyRules(definition) {
  const topics = (definition?.topics ?? []).map(({ id, terms }) => {
    const all = terms.flatMap(forms).map((form) => escape(form))
    return {
      id,
      pattern: new RegExp(
        `(?<![a-z0-9])(?:${all.sort((a, b) => b.length - a.length).join('|')})(?![a-z0-9])`,
      ),
      long: terms
        .map((term) => term.replaceAll(' ', ''))
        .filter((term) => term.length >= SQUASH_FROM),
    }
  })
  return { topics, sources: new Set(definition?.sources ?? []) }
}

/**
 * Every string in the parts of the item that say what it is about, found by walking them, so a
 * field added later is read without a code change. Answers `null` when a bound is passed.
 */
function textsOf(item) {
  const { candidate, source, draft, verification } = item
  const roots = [candidate, source, draft]
  if (isObject(verification)) roots.push(verification.location, verification.evidence)
  const texts = []
  let chars = 0
  let ok = true
  const walk = (value, depth) => {
    if (!ok || value === undefined || value === null) return
    if (typeof value === 'string') {
      chars += value.length
      texts.push(value)
      ok = texts.length <= MAX_STRINGS && chars <= MAX_CHARS
    } else if (typeof value === 'object') {
      if (depth >= MAX_DEPTH) ok = false
      else for (const inner of Object.values(value)) walk(inner, depth + 1)
    }
  }
  for (const root of roots) walk(root, 0)
  return ok ? texts : null
}

/** The ids of the sources an item came from: its own, the registry's, and those that matched it. */
function sourceIdsOf({ candidate, source }) {
  const also = Array.isArray(candidate.alsoReportedBy) ? candidate.alsoReportedBy : []
  return [candidate.sourceId, source?.id, ...also.map((other) => other?.sourceId)].filter(
    (id) => id !== undefined,
  )
}

/** Why the stages' answers don't clear the item: any answer but a plain `false` counts. */
function stageProblems({ verification, curation }) {
  return [
    ['verify', verification],
    ['curate', curation],
  ].flatMap(([stage, section]) => {
    if (!isObject(section) || section.safety === undefined || section.safety === null)
      return [`${stage} gave no safety answer`]
    if (section.safety === true) return [`${stage} says safety`]
    return section.safety === false ? [] : [`${stage}’s safety answer is not a boolean`]
  })
}

function classify(rules, item) {
  const why = stageProblems(item)
  const topics = new Set()
  if (!rules || !Array.isArray(rules.topics)) why.push('the definition is missing')
  else if (sourceIdsOf(item).some((id) => typeof id !== 'string' || rules.sources.has(id)))
    why.push('the source is a safety source')
  const texts = textsOf(item)
  if (texts === null) why.push('the item is too large to read')
  else {
    if (texts.some(mixesScripts)) why.push('a word mixes scripts')
    const seen = texts.flatMap(views)
    for (const { id, pattern, long } of rules?.topics ?? []) {
      if (
        seen.some(
          ({ folded, squashed }) =>
            pattern.test(folded) || long.some((term) => squashed.includes(term)),
        )
      )
        topics.add(id)
    }
  }
  if (topics.size > 0) why.push(`the text matches ${[...topics].join(', ')}`)
  return { safety: why.length > 0, topics: [...topics], why }
}

/**
 * Whether `item` is a safety item. Answers `{ safety, topics, why }`: `topics` are ids from the
 * definition and `why` fixed phrases, never the item's own words. Anything unreadable or missing
 * is safety.
 */
export function classifySafety(rules, item) {
  if (!isObject(item) || !isObject(item.candidate))
    return { safety: true, topics: [], why: ['the item can’t be read'] }
  try {
    return classify(rules, item)
  } catch {
    return { safety: true, topics: [], why: ['the item can’t be read'] }
  }
}
