// The one comment a pull request preview keeps on its pull request (#1075): found by a hidden marker
// and edited in place, so a new push never adds a second one. Loaded by the workflow's report job
// (actions/github-script). The text is built from a fixed list of states plus values checked here (a
// number, a commit, a link made from them), so no log line, request text or secret can reach it.

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
  limit: ['Not started.', 'Another preview is up, and only one runs at a time for now.'],
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

/** The comment's text. Throws on a value that isn't what it should be: better no comment than a wrong one. */
export function commentBody({ state, number, sha, url, time, runUrl }) {
  if (!Object.hasOwn(STATES, state)) throw new Error('unknown state')
  if (!/^[1-9][0-9]{0,5}$/.test(String(number))) throw new Error('not a pull request number')
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('not a commit')
  if (!/^https:\/\/[a-z0-9.-]+\/[\w.-]+\/[\w.-]+\/actions\/runs\/[0-9]+$/.test(runUrl))
    throw new Error('not a run link')
  if (!/^\d{4}-\d\d-\d\d \d\d:\d\d UTC$/.test(time)) throw new Error('not a time')
  const [headline, rest] = STATES[state]
  let sentence = `**${headline}**${rest ? ` ${rest}` : ''}`
  if (state === 'live') {
    if (
      !/^https:\/\/pr-[1-9][0-9]{0,5}\.[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(url) ||
      !url.startsWith(`https://pr-${number}.`)
    )
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
