/**
 * The one "Board status" comment per issue (#1435). It is built from fixed sentences only: the rule's
 * reason, the flags and the board's status names, never text taken from an issue, a comment or a
 * pull request. A hidden marker finds it again, and a second hidden line records the status the
 * planner last set, so a later event knows whether the planner set the card's current status.
 */
import { STATUS } from './planner-config.mjs'

export const BOARD_STATUS_MARKER = '<!-- planner:board-status -->'
const SET_PATTERN = /<!-- planner:set=([^>]+?) -->/

/**
 * @param {string} from  where the card was when the planner looked
 * @param {{status: string, reason: string, flags: string[]}} result  what the rule gives
 * @param {boolean} [held]  a backward move held for the owner: nothing was moved
 * @param {string|null} [set]  the status the planner set last, kept when a move is held
 */
export function boardStatusComment({ from, result, held = false, set = result.status }) {
  const flags = result.flags.map((flag) => `- ${flag}`)
  const sentence = held
    ? `The status rule puts this card in ${result.status}, but it is in ${from}. ${result.reason} Held for the owner's confirmation; nothing was moved.`
    : `When the planner last looked, the card was in ${from} and the status rule puts it in ${result.status}. ${result.reason}`
  return [
    BOARD_STATUS_MARKER,
    ...(set ? [`<!-- planner:set=${set} -->`] : []),
    '### Board status',
    '',
    sentence,
    ...(flags.length > 0
      ? ['', 'Flags (reported only, nothing was changed for them):', ...flags]
      : []),
  ].join('\n')
}

/** The status the planner last set, from its comment body, or null. */
export function plannerSetStatus(body) {
  const name = SET_PATTERN.exec(body ?? '')?.[1]
  return Object.values(STATUS).includes(name) ? name : null
}

const loginOf = (login = '') => login.replace(/\[bot\]$/, '')

/**
 * The comment the app named `slug` keeps on an issue, from comments as `{ id, type, login, body }`:
 * written by that app (REST gives `slug[bot]`, GraphQL `slug`) and starting with the marker. Without
 * a slug nothing matches, so no other author's comment is ever taken over.
 */
export const findStatusComment = (comments, slug) =>
  slug
    ? (comments.find(
        (entry) =>
          entry.type === 'Bot' &&
          loginOf(entry.login) === slug &&
          entry.body.startsWith(BOARD_STATUS_MARKER),
      ) ?? null)
    : null
