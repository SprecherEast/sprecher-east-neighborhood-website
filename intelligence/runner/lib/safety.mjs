// What counts as a safety item (#1007). The definition is `safety.yaml`, written once; this file
// only reads it. The answer errs toward "safety": an item is clear only when verify and curate
// both said `safety: false`, its source isn't a safety source, and no term of the definition
// appears in any text of the item. Text from a source or a model can only add to the answer,
// never remove from it.

import { wordsPattern } from './text.mjs'

export const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

// What is read: depth, the number of strings, and their size are bounded; an item that goes past
// a bound can't be read in full, so it counts as safety.
const MAX_DEPTH = 8
const MAX_STRINGS = 400
const MAX_CHARS = 200_000
// A term of this many letters or more also matches with single spaces inside it ("po lice")
const SPREAD_FROM = 6

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
const FILLERS = /[\u115F\u1160\u3164\uFFA0\p{M}\p{Cf}]/gu

/** The text (already NFKC, which folds width) with accents, invisible marks, case and punctuation folded away. */
function foldText(text) {
  return text
    .normalize('NFD')
    .replace(FILLERS, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** A word that mixes scripts can't be read safely: look-alike letters could spell a term. */
const mixesScripts = (text) =>
  text
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

/** Every form of the text a term could be matched against: as written, and with digits and symbols read as letters. */
function views(text) {
  const lowered = text.toLowerCase()
  return [lowered, unLeet(lowered, 'i'), unLeet(lowered, 'l')].map(foldText)
}

const VOWELS = 'aeiou'

/**
 * A term with the endings a word takes: s, es, ed, d, ing, a doubled last consonant after one
 * vowel (stab, stabbed), -y as -ies or -ied, -f or -fe as -ves, and a Spanish -o as -a or -as.
 * The ending goes on the last word of a phrase.
 */
function forms(term) {
  const at = term.lastIndexOf(' ') + 1
  const head = term.slice(0, at)
  const word = term.slice(at)
  const endings = new Set([word, `${word}s`, `${word}es`, `${word}ed`, `${word}d`])
  endings.add(word.endsWith('e') ? `${word.slice(0, -1)}ing` : `${word}ing`)
  const [before, vowel, last] = [...word.slice(-3)]
  if (
    word.length >= 3 &&
    !VOWELS.includes(before) &&
    VOWELS.includes(vowel) &&
    !VOWELS.includes(last) &&
    !'wxy'.includes(last)
  ) {
    endings.add(`${word}${last}ed`)
    endings.add(`${word}${last}ing`)
  }
  if (word.endsWith('y')) {
    endings.add(`${word.slice(0, -1)}ies`)
    endings.add(`${word.slice(0, -1)}ied`)
  }
  if (word.endsWith('fe')) endings.add(`${word.slice(0, -2)}ves`)
  else if (word.endsWith('f')) endings.add(`${word.slice(0, -1)}ves`)
  if (word.endsWith('o')) {
    endings.add(`${word.slice(0, -1)}a`)
    endings.add(`${word.slice(0, -1)}as`)
  }
  return [...endings].map((ending) => `${head}${ending}`)
}

/** Compiles safety.yaml (already checked against schemas/safety.schema.json) into matchers. */
export function compileSafetyRules(definition) {
  const topics = (definition?.topics ?? []).map(({ id, terms }) => ({
    id,
    pattern: wordsPattern(terms.flatMap(forms), { flags: '', spreadFrom: SPREAD_FROM }),
  }))
  return { topics, sources: new Set(definition?.sources ?? []) }
}

/** The safety sources `definition` lists that `registry` doesn't hold: the one check for the runner and the script. */
export const unregisteredSafetySources = (definition, registry) => {
  const registered = new Set((registry?.sources ?? []).map((source) => source.id))
  return (definition?.sources ?? []).filter((id) => !registered.has(id))
}

/**
 * Every string in the parts of the item that say what it is about, found by walking them, so a
 * field added later is read without a code change: the candidate and the draft, the verification's
 * place, evidence and reason, and the curation's own words. The registry's entry is not text:
 * only its id is used, for the source list. Answers `null` when a bound is passed.
 */
function textsOf({ candidate, draft, verification, curation }) {
  const roots = [candidate, draft]
  if (isObject(verification))
    roots.push(verification.location, verification.evidence, verification.coverageReason)
  if (isObject(curation))
    roots.push(curation.reasons, curation.whyItMatters, curation.residentAction)
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

/** Why the source can't clear the item: it must be known, match the candidate, and not be listed. */
function sourceProblems(rules, { candidate, source }) {
  const also = Array.isArray(candidate.alsoReportedBy) ? candidate.alsoReportedBy : []
  const ids = [candidate.sourceId, source?.id, ...also.map((other) => other?.sourceId)]
  if (
    !isObject(source) ||
    typeof candidate.sourceId !== 'string' ||
    source.id !== candidate.sourceId
  )
    return ['the source facts are missing or don’t match']
  return ids.some((id) => typeof id !== 'string' || rules.sources.has(id))
    ? ['the source is a safety source']
    : []
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
  else why.push(...sourceProblems(rules, item))
  const texts = textsOf(item)?.map((text) => text.normalize('NFKC'))
  if (texts === undefined) why.push('the item is too large to read')
  else {
    if (texts.some(mixesScripts)) why.push('a word mixes scripts')
    // Each string alone, and all of them joined in order, so a term split across two fields is found
    const seen = [...texts, texts.join(' ')].flatMap(views)
    for (const { id, pattern } of rules?.topics ?? []) {
      if (seen.some((folded) => pattern.test(folded))) topics.add(id)
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
