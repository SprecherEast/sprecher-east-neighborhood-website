// The one comment a pull request preview keeps on its pull request (#1075): found by a hidden marker
// and edited in place, so a new push never adds a second one. Loaded by the workflow's report job
// (actions/github-script). The text is built from a fixed list of states plus values checked here (a
// number, a commit, a link made from them), so no log line, request text or secret can reach it.

// Kept equal to ops/environment.sh's PREVIEW_NUMBER_PATTERN and PREVIEW_COMMIT_PATTERN by a test.
export const NUMBER_PATTERN = /^[1-9][0-9]{0,5}$/
export const COMMIT_PATTERN = /^[0-9a-f]{40}$/
const CAP_PATTERN = /^[1-9][0-9]{0,2}$/
const HOLDERS_PATTERN = /^[1-9][0-9]{0,5}(,[1-9][0-9]{0,5})*$/
export const MARKER = '<!-- pull-request-preview -->'
const BOT = 'github-actions[bot]'

/** state → [bold headline, rest of the sentence]. */
const STATES = {
  live: ['Live.', ''],
  failed: [
    'The preview did not go live.',
    'If it had an earlier build, the server put it back. The workflow run has the log.',
  ],
  'taken-down': [
    'Taken down.',
    'The server’s isolation check failed, so this preview was stopped and removed. The workflow run has the log.',
  ],
  // `limit` gets the cap and the pull requests that hold the places (see `limitSentence`).
  limit: ['Not started.', ''],
  'disk-low': [
    'Not started.',
    'The server does not have the free disk this preview needs without going below what production keeps free. It starts when a push or a re-run finds room.',
  ],
  removed: [
    'Removed.',
    'This pull request is closed, so its preview was taken down. A reopened pull request gets a new preview.',
  ],
  'too-big': [
    'Not started.',
    'The build is bigger than a preview may be, as sent or once unpacked.',
  ],
  unreadable: ['Not started.', 'The build’s archive could not be measured, so it was not sent.'],
  'check-failed': [
    'Not started.',
    'The check of the preview server failed (the log says how), so nothing was built.',
  ],
  'build-failed': ['The build failed.', 'Nothing was deployed. The workflow run has the log.'],
  unavailable: [
    'Previews are unavailable.',
    'The server did not take the preview key or could not be reached, or the environment does not hold the key yet. Nothing was built, and nothing will be retried.',
  ],
}

/** What the jobs ended with, as one of the states above.
 * `available` is the facts job's output, `buildResult` the build job's result and `deployResult` the
 * deploy script's output (empty when it never got to write one). */
export function previewState({ available, buildResult, deployResult }) {
  if (deployResult && Object.hasOwn(STATES, deployResult)) return deployResult
  if (available === 'no') return 'unavailable'
  if (available !== 'yes') return 'check-failed'
  if (buildResult === 'failure') return 'build-failed'
  return 'failed'
}

/** What `limit` says: the cap, and which pull requests hold the places when that is known. Both are checked, being a
 * job's output. With no holders (the server's list could not be read again after a race) the sentence names none. */
function limitSentence(cap, holders) {
  const named = holders !== undefined && holders !== null && String(holders) !== ''
  if (!CAP_PATTERN.test(String(cap)) || (named && !HOLDERS_PATTERN.test(String(holders))))
    throw new Error('not a cap and the pull requests that hold it')
  const one = Number(cap) === 1
  const places = one ? 'one preview runs' : `${cap} previews run`
  const when = 'This one starts when a place frees up and a push or a re-run asks again.'
  if (!named)
    return `Only ${places} at a time, and ${one ? 'it is' : 'the places are'} taken. ${when}`
  const list = String(holders)
    .split(',')
    .map((n) => `#${n}`)
    .join(', ')
  return `Only ${places} at a time, and ${list} ${list.includes(',') ? 'hold' : 'holds'} ${one ? 'it' : 'the places'}. ${when}`
}

/** The comment's text. Throws on a value that isn't what it should be: better no comment than a wrong one. */
export function commentBody({ state, number, sha, url, time, runUrl, cap, holders }) {
  if (!Object.hasOwn(STATES, state)) throw new Error('unknown state')
  if (!NUMBER_PATTERN.test(String(number))) throw new Error('not a pull request number')
  if (!COMMIT_PATTERN.test(sha)) throw new Error('not a commit')
  if (!/^https:\/\/[a-z0-9.-]+\/[\w.-]+\/[\w.-]+\/actions\/runs\/[0-9]+$/.test(runUrl))
    throw new Error('not a run link')
  if (!/^\d{4}-\d\d-\d\d \d\d:\d\d UTC$/.test(time)) throw new Error('not a time')
  const [headline, rest] = STATES[state]
  let sentence = `**${headline}**${rest ? ` ${rest}` : ''}`
  if (state === 'limit') sentence = `**${headline}** ${limitSentence(cap, holders)}`
  if (state === 'live') {
    // `number` was checked above, so it is digits only and the address needs no pattern of its own
    if (!new RegExp(`^https://pr-${number}\\.[a-z0-9-]+(\\.[a-z0-9-]+)+$`).test(url))
      throw new Error('not the preview address')
    sentence += ` ${url}`
  }
  return [
    MARKER,
    '### Pull request preview',
    '',
    sentence,
    '',
    `Commit \`${sha.slice(0, 7)}\` · ${time} · [workflow run](${runUrl})`,
  ].join('\n')
}

/** `2026-11-20 21:10 UTC` for a Date. */
export function utcMinutes(date) {
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

/** The comment this feature already left: the oldest one with the marker that GitHub Actions wrote. */
export function findStickyComment(comments) {
  return comments.find((c) => c.user?.login === BOT && c.body?.includes(MARKER))
}
