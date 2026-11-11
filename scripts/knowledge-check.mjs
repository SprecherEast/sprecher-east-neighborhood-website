/**
 * The knowledge check, run locally (#1033). It reads the same rule CI applies in `PR Policy`
 * (`.github/scripts/knowledge-sync.mjs`) and runs it on the diff of the current branch against its
 * base, so a missing note update is found before the pull request opens, not after. CI stays the
 * backstop. Usage: `npm run knowledge:check [-- --base origin/main] [-- --body-file draft.md]`;
 * the draft description supplies the `Behavior change:` line, as it does in CI.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

import { knowledgeProblems } from '../.github/scripts/knowledge-sync.mjs'
import { withRuleId } from '../.github/scripts/pr-body.mjs'

const STATUS = { A: 'added', C: 'added', D: 'removed', M: 'modified', R: 'renamed', T: 'modified' }

/** `git diff --name-status -M` as the file list GitHub gives the CI check. */
export function parseNameStatus(text) {
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [code, first, second] = line.split('\t')
      const status = STATUS[code[0]] ?? 'modified'
      return second === undefined
        ? { filename: first, status }
        : { filename: second, previous_filename: first, status }
    })
}

/** A file's diff without its header lines, which is what GitHub's `patch` holds. */
export function patchOf(diff) {
  const start = diff.search(/^@@/m)
  return start === -1 ? '' : diff.slice(start).trimEnd()
}

/** The problems CI would report for these files, each starting with its rule ID. */
export function checkKnowledge({ mapJson, files, noteExists, body }) {
  return withRuleId('PR-KNOWLEDGE', knowledgeProblems({ mapJson, files, noteExists, body }))
}

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim()

function option(name, fallback) {
  const at = process.argv.indexOf(name)
  return at === -1 ? fallback : process.argv[at + 1]
}

function run() {
  const base = option('--base', 'origin/main')
  const bodyFile = option('--body-file')
  const mergeBase = git('merge-base', base, 'HEAD')
  const files = parseNameStatus(git('diff', '-M', '--name-status', mergeBase, 'HEAD')).map(
    (file) => ({
      ...file,
      patch: patchOf(
        git(
          'diff',
          '-M',
          mergeBase,
          'HEAD',
          '--',
          ...[file.previous_filename, file.filename].filter(Boolean),
        ),
      ),
    }),
  )
  if (git('status', '--porcelain')) {
    console.log('Note: uncommitted changes are not part of this check. Commit them first.')
  }
  if (!bodyFile) {
    console.log(
      'Note: no description given, so "Behavior change: none" cannot count. Pass --body-file.',
    )
  }
  const problems = checkKnowledge({
    mapJson: fs.readFileSync('docs/knowledge/map.json', 'utf8'),
    files,
    noteExists: (note) => fs.existsSync(note),
    body: bodyFile ? fs.readFileSync(bodyFile, 'utf8') : '',
  })
  if (problems.length === 0) return console.log('Knowledge check: in sync.')
  console.log(problems.join('\n'))
  process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run()
