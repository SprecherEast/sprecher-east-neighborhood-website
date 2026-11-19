// What stops a session filing an incomplete issue, and what it is told at the start (#1300). Pure
// functions, tested in filing.test.mjs; before-bash.mjs and session-start.mjs only call them. The
// issue check and the pull request gate stay the real gates: this refuses earlier, at the command.
import { issueProblems } from '../../.github/scripts/issue-policy.mjs'
import { parseCommands } from './rules.mjs'

/** What every session is told first: the process steps that must not rely on being remembered */
export const SESSION_REMINDER = [
  'Process, every session (AGENTS.md; nothing here replaces it):',
  '- Before filing an issue read docs/process/filing-checklist.md, search the open and closed issues for duplicates, and file from the form sections, with the result under "Existing work compared". The Bash hook refuses an issue that lacks them.',
  '- Claim an issue by assigning it, and mark one Ready with the `ready` label. Never move a card by hand: the planner app does, and a PR that closes the issue moves it to In review, a merge to Done.',
  '- After a claim, a PR and a merge, read the card: `node .github/scripts/card-history.mjs <issue>` exits 1 on a move made by hand.',
  '- Review by a session that did not write the change; merge only when the checks and that review allow.',
].join('\n')

/** The `gh api` flags that take a value, so the value is not mistaken for the endpoint */
const VALUE_FLAGS = new Set([
  '-X',
  '--method',
  '-H',
  '--header',
  '-f',
  '--raw-field',
  '-F',
  '--field',
  '--input',
  '-q',
  '--jq',
  '-t',
  '--template',
  '--hostname',
  '--cache',
  '-p',
  '--preview',
])

/** The endpoint of a `gh api` call: the first word that is neither a flag nor a flag's value */
function apiEndpoint(words) {
  for (let i = 2; i < words.length; i++) {
    if (VALUE_FLAGS.has(words[i])) i++
    else if (!words[i].startsWith('-')) return words[i]
  }
  return null
}

const ISSUES_ENDPOINT = /^\/?repos\/[^/]+\/[^/]+\/issues$/

/** `key=value` fields of a gh api call, keyed by name; `labels[]` collects into a list */
function apiFields(words, readFile) {
  const request = { title: '', body: '', labels: [], milestone: null, unreadable: null }
  const take = (field, raw) => {
    const at = field.indexOf('=')
    if (at < 0) return
    const key = field.slice(0, at)
    const value = field.slice(at + 1)
    if (key === 'labels[]') request.labels.push(value)
    else if (key === 'title') request.title = value
    else if (key === 'milestone') request.milestone = value
    else if (key === 'body') {
      if (!raw && value.startsWith('@')) {
        try {
          request.body = readFile(value.slice(1))
        } catch {
          request.unreadable = 'body file'
        }
      } else request.body = value
    }
  }
  for (let i = 2; i < words.length; i++) {
    const word = words[i]
    if (word === '-f' || word === '--raw-field') take(words[++i] ?? '', true)
    else if (word === '-F' || word === '--field') take(words[++i] ?? '', false)
    else if (word === '--input') {
      const file = words[++i]
      try {
        const json = JSON.parse(readFile(file))
        request.title = json.title ?? ''
        request.body = json.body ?? ''
        request.labels.push(...(json.labels ?? []).map((l) => l?.name ?? l))
        request.milestone = json.milestone ?? null
      } catch {
        request.unreadable = 'input'
      }
    }
  }
  return request
}

/** The flags of a `gh issue create` call */
function issueCreateFields(words, readFile) {
  const request = { title: '', body: '', labels: [], milestone: null, unreadable: null }
  for (let i = 3; i < words.length; i++) {
    const word = words[i]
    const value = words[i + 1] ?? ''
    if (word === '-t' || word === '--title') request.title = words[++i] ?? ''
    else if (word === '-b' || word === '--body') request.body = words[++i] ?? ''
    else if (word === '-F' || word === '--body-file') {
      i++
      try {
        request.body = readFile(value)
      } catch {
        request.unreadable = 'body file'
      }
    } else if (word === '-l' || word === '--label') {
      i++
      request.labels.push(
        ...value
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
      )
    } else if (word === '-m' || word === '--milestone') request.milestone = words[++i] ?? null
  }
  return request
}

/**
 * The issues a Bash command creates: `gh api` to the repository's issues endpoint with a POST
 * (given, or implied by fields or `--input`), and `gh issue create`. Each is `{ title, body,
 * labels, milestone, unreadable }`, where `unreadable` says what could not be read.
 * @param {string} command
 * @param {(file: string) => string} [readFile]
 */
export function filingRequests(command, readFile = () => '') {
  const requests = []
  for (const words of parseCommands(command)) {
    if (words[0] !== 'gh') continue
    if (words[1] === 'issue' && words[2] === 'create') {
      requests.push(issueCreateFields(words, readFile))
    } else if (words[1] === 'api') {
      const endpoint = apiEndpoint(words)
      if (!endpoint || !ISSUES_ENDPOINT.test(endpoint)) continue
      const method = words.findIndex((w) => w === '-X' || w === '--method')
      const verb = method >= 0 ? (words[method + 1] ?? '').toUpperCase() : null
      const hasFields = words.some((w) => /^(-f|-F|--field|--raw-field|--input)$/.test(w))
      if (verb ? verb !== 'POST' : !hasFields) continue
      const request = apiFields(words, readFile)
      if (words[words.indexOf('--input') + 1] === '-') request.unreadable = 'input'
      requests.push(request)
    }
  }
  return requests
}

/**
 * Why the Bash command may not run, or null: it creates an issue that fails the issue rules (with
 * the duplicate-search record), or whose body the hook cannot read.
 * @param {string} command
 * @param {{ policy: object, readFile: (file: string) => string }} context
 */
export function filingCheck(command, { policy, readFile }) {
  for (const request of filingRequests(command, readFile)) {
    if (request.unreadable === 'input' && !request.body) {
      return 'Filing: pass the issue as --input <file> (JSON) or -F body=@<file>, not on standard input, so it can be checked against the filing checklist (docs/process/filing-checklist.md).'
    }
    if (request.unreadable) {
      return 'Filing: the body file could not be read. Write it first, then pass -F body=@<file> (docs/process/filing-checklist.md).'
    }
    const issue = {
      body: request.body,
      labels: request.labels.map((name) => ({ name })),
      milestone: request.milestone ? { title: String(request.milestone) } : null,
      state: 'open',
    }
    const problems = issueProblems(issue, policy, { filing: true })
    if (problems.length) {
      return `Filing: this issue would fail the issue check. Fix each, then file it again (docs/process/filing-checklist.md):\n- ${problems.join('\n- ')}`
    }
  }
  return null
}
