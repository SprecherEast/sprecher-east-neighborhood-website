/**
 * Reads an issue's body the way the issue forms write it (`### <Label>` then the answer): the one
 * reader for `Issue Labels` (which turns the answers into labels) and the issue check (which looks
 * for the sections a groomed issue has). The form's empty answer is defined here, once.
 */
import { headingBlocks } from './pr-body.mjs'

/** What GitHub writes for a form field left empty. */
export const NO_RESPONSE = '_No response_'

/**
 * Every heading of the body in order as `{ title, text }`: title lower-cased, text trimmed, the
 * empty answer read as empty. Third-level headings only, as the forms write them, unless a wider
 * range is asked for. A heading inside an HTML comment is not there (Markdown hides it, so a
 * reader of the issue can't see it either). An unclosed `<!--` hides every later answer, also
 * inside a code span or a code block: deliberate, the same reading the PR gate gives a
 * description. A code block is no cover, so leave such an opener out and describe it in words.
 */
export function formAnswers(body, { minLevel = 3, maxLevel = 3 } = {}) {
  return headingBlocks(body, { minLevel, maxLevel }).map(({ title, text }) => ({
    title,
    text: text.trim() === NO_RESPONSE ? '' : text.trim(),
  }))
}

/**
 * The labels a form's answers ask for. Only answers whose values are all valid options count, so a
 * heading typed inside a free-text answer can't spoof a dropdown. Type is the first field of its
 * forms, so the first valid Type wins; Area and Priority are the last fields, so the last valid
 * one wins.
 */
export function formChoices(body, policy) {
  const answers = formAnswers(body).map(({ title, text }) => ({
    title,
    values: text
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  }))
  const valid = (title, allowed) =>
    answers
      .filter(
        (a) => a.title === title && a.values.length && a.values.every((v) => allowed.includes(v)),
      )
      .map((a) => a.values)
  return {
    type: valid('type', policy.types)[0]?.[0],
    areas: valid('area', policy.areas).at(-1) || [],
    priority: valid('priority', Object.keys(policy.priorities)).at(-1)?.[0],
  }
}
