/**
 * The two inputs the page reads that are not part of the committed graph (#1462): the change
 * history from `git log` and the dated snapshot of the open issues. They change without a code
 * change, so they go to a folder git ignores. A run without history or network writes an empty
 * file marked as such, and never fails.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { GIT_LOG_FORMAT, buildHistory, parseGitLog } from './history.mjs'
import { REPOSITORY } from './vocabulary.mjs'
import { buildSnapshot, emptySnapshot } from './snapshot.mjs'

export const EXTRAS_DIR = '.knowledge-map'
const COMMITS_READ = 400

/** Runs a command and returns what it printed; the default for `run`, replaced in tests. */
export const runCommand = (command, args, options = {}) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })

function readHistory({ root, graph, run }) {
  try {
    const log = run(
      'git',
      ['log', '--name-only', `--format=${GIT_LOG_FORMAT}`, '-n', String(COMMITS_READ)],
      { cwd: root },
    )
    return buildHistory({ graph, commits: parseGitLog(log) })
  } catch {
    return buildHistory({ graph, commits: [] })
  }
}

function readSnapshot({ root, graph, run, date }) {
  try {
    const out = run(
      'gh',
      [
        'api',
        '--paginate',
        '--slurp',
        `repos/${REPOSITORY.owner}/${REPOSITORY.name}/issues?state=open&per_page=100`,
      ],
      { cwd: root },
    )
    return buildSnapshot({ graph, issues: JSON.parse(out).flat(), date })
  } catch {
    return emptySnapshot('the open issues could not be read', date)
  }
}

/** Writes `history.json` and `snapshot.json` under the extras folder; says which could be read. */
export function writeExtras({ root, graph, run = runCommand, date }) {
  const history = readHistory({ root, graph, run })
  const snapshot = readSnapshot({ root, graph, run, date })
  const folder = path.join(root, EXTRAS_DIR)
  fs.mkdirSync(folder, { recursive: true })
  fs.writeFileSync(path.join(folder, 'history.json'), `${JSON.stringify(history, null, 1)}\n`)
  fs.writeFileSync(path.join(folder, 'snapshot.json'), `${JSON.stringify(snapshot, null, 1)}\n`)
  return { history: history.available, snapshot: snapshot.available }
}
