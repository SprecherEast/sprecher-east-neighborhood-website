/**
 * Reads a card's history from the issue's timeline (#1300): who changed its Status, and when. The
 * board moves by itself (the planner app and GitHub's own automation), so a status change made by
 * a person's login is a hand move, against the rules in docs/process/project-management.md.
 * `node .github/scripts/card-history.mjs <issue>` prints the history and exits 1 on a hand move.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const STATUS_CHANGE = 'project_v2_item_status_changed'

/** The status changes of a timeline, oldest first, as `{ at, actor, bot }` */
export function cardMoves(events) {
  return events
    .filter((event) => event.event === STATUS_CHANGE)
    .map((event) => ({
      at: event.created_at,
      actor: event.actor?.login ?? 'unknown',
      bot: event.actor?.type === 'Bot',
    }))
    .sort((a, b) => a.at.localeCompare(b.at))
}

/** Whether every move was the board's own; `byHand` lists the ones made by a person's login */
export function cardVerdict(events) {
  const moves =
    Array.isArray(events) && events.every((e) => 'bot' in e) ? events : cardMoves(events)
  const byHand = moves.filter((move) => !move.bot).map(({ at, actor }) => ({ at, actor }))
  return { ok: byHand.length === 0, moves, byHand }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const number = process.argv[2]
  if (!/^\d+$/.test(number ?? '')) {
    console.error('Usage: node .github/scripts/card-history.mjs <issue number>')
    process.exit(2)
  }
  const output = execFileSync(
    'gh',
    ['api', '--paginate', '--slurp', `repos/{owner}/{repo}/issues/${number}/timeline`],
    { encoding: 'utf8' },
  )
  const { ok, moves, byHand } = cardVerdict(JSON.parse(output).flat())
  for (const move of moves) console.log(`${move.at}  ${move.actor}${move.bot ? '' : '  (by hand)'}`)
  if (!moves.length) console.log('The card has not moved.')
  if (!ok) {
    console.error(`${byHand.length} status change(s) made by hand: the board moves by itself.`)
    process.exit(1)
  }
}
