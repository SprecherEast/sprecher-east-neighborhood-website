#!/usr/bin/env node
// PreToolUse hook on Bash (#446): refuses the commands AGENTS.md forbids before they run, and a
// commit whose `src/payload-types.ts` change is only `next dev` reformatting it. A real schema
// change to that file still commits. Git questions go to the directory the command runs in (the
// hook input's `cwd`), so a worktree is judged by its own branch and index. Exit 2 blocks the
// command and shows Claude why; anything unexpected lets the command run.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { filingCheck } from './filing.mjs'
import { git, readInput, repoRoot } from './io.mjs'
import { GENERATED_TYPES, inspect } from './rules.mjs'

const input = readInput()
const command = input?.tool_input?.command
if (typeof command !== 'string') process.exit(0)

const block = (reason) => {
  process.stderr.write(`Blocked: ${reason}\n`)
  process.exit(2)
}

const found = inspect(command)
if (found.reason) block(found.reason)

const cwd = input.cwd || process.cwd()

// An issue created from the command line must pass the issue rules first (#1300)
if (/\bgh\b/.test(command)) {
  try {
    const root = repoRoot(cwd) ?? cwd
    const policy = JSON.parse(readFileSync(path.join(root, '.github/label-policy.json'), 'utf8'))
    const filing = filingCheck(command, {
      policy,
      readFile: (file) => readFileSync(path.resolve(cwd, file), 'utf8'),
    })
    if (filing) block(filing)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

if (found.barePush && git(cwd, 'branch', '--show-current') === 'main') {
  block('AGENTS.md: never push to main; work on a branch and open a pull request.')
}

const root = found.commits.length ? repoRoot(cwd) : null
if (root) {
  const staged = git(root, 'diff', '--cached', '--name-only').split('\n')
  const all = found.commits.some((commit) => commit.all)
  const unstaged = all ? git(root, 'diff', '--name-only').split('\n') : []
  const file = path.join(root, GENERATED_TYPES)
  // What the commit would store: the working tree with `-a`, otherwise the index
  let next = null
  if (unstaged.includes(GENERATED_TYPES))
    next = existsSync(file) ? readFileSync(file, 'utf8') : null
  else if (staged.includes(GENERATED_TYPES)) next = git(root, 'show', `:${GENERATED_TYPES}`) || null
  const before = next ? git(root, 'show', `HEAD:${GENERATED_TYPES}`) : ''
  if (next && before && (await formattingOnly(root, before, next))) {
    block(
      `${GENERATED_TYPES} changed only in formatting: \`next dev\` rewrote it. Restore it ` +
        `(git checkout ${GENERATED_TYPES}); after a real schema change, \`npm run generate:types\`.`,
    )
  }
}

/** Whether two versions of the generated types differ only in formatting */
async function formattingOnly(root, a, b) {
  if (a === b) return false
  try {
    // Prettier loads its plugins from the current directory
    process.chdir(root)
    const prettier = await import(
      pathToFileURL(path.join(root, 'node_modules/prettier/index.mjs')).href
    )
    const options = {
      ...(await prettier.resolveConfig(path.join(root, GENERATED_TYPES))),
      parser: 'typescript',
    }
    return (await prettier.format(a, options)) === (await prettier.format(b, options))
  } catch {
    return false
  }
}
