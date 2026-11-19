// What stops a session filing an incomplete issue, and what it is told at the start (#1300). Pure
// functions, tested in filing.test.mjs; before-bash.mjs and session-start.mjs only call them. The
// issue check and the pull request gate stay the real gates: this refuses earlier, at the command.
import { issueProblems } from '../../.github/scripts/issue-policy.mjs'
import { parseCommands } from './rules.mjs'

/** What every session is told first: the process steps that must not rely on being remembered */
export const SESSION_REMINDER = [
  'Process, every session (AGENTS.md; nothing here replaces it):',
  '- Before filing an issue read docs/process/filing-checklist.md, search the open and closed issues for duplicates, and file from the form sections, with the result under "Existing work compared". The Bash hook refuses an issue that lacks them.',
  '- Claim an issue by assigning it, and mark one Ready with the `ready` label. Never move a card by hand: the planner app does (the one exception is the documented fallback when it did not act, recorded on the issue), and a PR that closes the issue moves it to In review, a merge to Done.',
  '- After a claim, a PR and a merge, read the card: `node .github/scripts/card-history.mjs <issue>` exits 1 on a move made by hand.',
  '- Review by a session that did not write the change; merge only when the checks and that review allow.',
].join('\n')

/** The issues endpoint of a repository, as `gh api` is given it */
const ISSUES_ENDPOINT = /^\/?repos\/[^/]+\/[^/]+\/issues$/

/** The flags of each gh command that take a value, so the value is not mistaken for a word */
const API_VALUE_FLAGS = [
  ...['-X', '--method', '-H', '--header', '-f', '--raw-field', '-F', '--field', '--input'],
  ...['-q', '--jq', '-t', '--template', '--hostname', '--cache', '-p', '--preview'],
]
const CREATE_VALUE_FLAGS = [
  ...['-t', '--title', '-b', '--body', '-F', '--body-file', '-l', '--label', '-m', '--milestone'],
  ...['-a', '--assignee', '-p', '--project', '-T', '--template', '-R', '--repo', '--recover'],
]

/**
 * Splits a gh command's words into its flags (`[name, value]`, value null for a switch) and its
 * other words. Reads `--flag value`, `--flag=value`, `-f value` and `-fvalue`.
 */
function parseFlags(words, valueFlags) {
  const flags = []
  const rest = []
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const equals = word.startsWith('--') ? word.indexOf('=') : -1
    const name = equals > 0 ? word.slice(0, equals) : word
    const short = !word.startsWith('--') && word.length > 2 ? word.slice(0, 2) : null
    if (valueFlags.includes(name)) {
      flags.push([name, equals > 0 ? word.slice(equals + 1) : (words[++i] ?? '')])
    } else if (short && valueFlags.includes(short)) flags.push([short, word.slice(2)])
    else if (word.startsWith('-') && word.length > 1) flags.push([name, null])
    else rest.push(word)
  }
  return { flags, rest }
}

/** The words of a command from `gh` on: a leading `VAR=x`, `env`, `command` or a path is skipped */
function ghWords(words) {
  let i = 0
  while (i < words.length && (/^\w+=/.test(words[i]) || ['env', 'command'].includes(words[i]))) i++
  return words[i] && words[i].split('/').pop() === 'gh' ? words.slice(i) : null
}

/** An issue creation as read from the command; `unreadable` says what the hook could not read */
function emptyRequest(how) {
  return { title: '', body: '', labels: [], milestone: null, unreadable: null, how }
}

/** Reads the file `file` into the request's body, or marks the body unreadable */
function readBody(request, file, readFile) {
  if (/[$`]|^~/.test(file)) request.unreadable = 'path'
  else
    try {
      request.body = readFile(file)
    } catch {
      request.unreadable = 'path'
    }
}

/** A body that is wholly a shell expansion (`$(cat f)`): its text is not in the command */
const isExpansion = (value) => /^\s*(\$|`)/.test(value)

/** Sets a field of the request from `key` and `value`; `raw` is `-f`, which never reads a file */
function setField(request, key, value, raw, readFile) {
  if (key === 'labels[]') request.labels.push(value)
  else if (key === 'title') request.title = value
  else if (key === 'milestone') request.milestone = value
  else if (key === 'body') {
    if (!raw && value.startsWith('@')) readBody(request, value.slice(1), readFile)
    else if (isExpansion(value)) request.unreadable = 'expansion'
    else request.body = value
  }
}

const FIELD_FLAGS = { '-f': true, '--raw-field': true, '-F': false, '--field': false }

/** The issue a `gh api` call posts, or null when it is not a POST to the issues endpoint */
function apiRequest(words, readFile) {
  const { flags, rest } = parseFlags(words.slice(2), API_VALUE_FLAGS)
  const endpoint = (rest[0] ?? '').replace(/^https?:\/\/[^/]+/, '').split('?')[0]
  if (!ISSUES_ENDPOINT.test(endpoint)) return null
  const verb = flags.findLast(([name]) => name === '-X' || name === '--method')?.[1]
  const sent = flags.filter(([name]) => name in FIELD_FLAGS || name === '--input')
  if (verb ? verb.toUpperCase() !== 'POST' : !sent.length) return null
  const request = emptyRequest('api')
  for (const [name, value] of sent) {
    if (name === '--input') {
      try {
        const json = JSON.parse(readFile(value))
        Object.assign(request, { title: json.title ?? '', body: json.body ?? '' })
        request.labels.push(...(json.labels ?? []).map((label) => label?.name ?? label))
        request.milestone = json.milestone ?? null
      } catch {
        request.unreadable = value === '-' ? 'input' : 'path'
      }
    } else {
      const at = value.indexOf('=')
      if (at > 0)
        setField(request, value.slice(0, at), value.slice(at + 1), FIELD_FLAGS[name], readFile)
    }
  }
  return request
}

/** The issue a `gh issue create` call makes */
function createRequest(words, readFile) {
  const { flags } = parseFlags(words.slice(3), CREATE_VALUE_FLAGS)
  const request = emptyRequest('create')
  for (const [name, value] of flags) {
    if (name === '-t' || name === '--title') request.title = value
    else if (name === '-b' || name === '--body') {
      if (isExpansion(value)) request.unreadable = 'expansion'
      else request.body = value
    } else if (name === '-F' || name === '--body-file') readBody(request, value, readFile)
    else if (name === '-l' || name === '--label')
      request.labels.push(
        ...value
          .split(',')
          .map((label) => label.trim())
          .filter(Boolean),
      )
    else if (name === '-m' || name === '--milestone') request.milestone = value
  }
  if (flags.some(([name, value]) => name === '--body-file' && value === '-'))
    request.unreadable = 'input'
  return request
}

/**
 * The issues a Bash command creates: `gh api` to the repository's issues endpoint with a POST
 * (given, or implied by fields or `--input`), and `gh issue create`. Each is `{ title, body,
 * labels, milestone, unreadable, how }`; `unreadable` says what could not be read.
 * @param {string} command
 * @param {(file: string) => string} [readFile]
 */
export function filingRequests(command, readFile = () => '') {
  const requests = []
  for (const all of parseCommands(command)) {
    const words = ghWords(all)
    if (!words) continue
    const request =
      words[1] === 'issue' && words[2] === 'create'
        ? createRequest(words, readFile)
        : words[1] === 'api'
          ? apiRequest(words, readFile)
          : null
    if (request) requests.push(request)
  }
  return requests
}

const PASS = {
  api: '-F body=@<absolute file> or --input <absolute file>',
  create: '--body-file <absolute file>',
}

/** Why a body could not be read, with how to pass it */
function unreadableReason(request) {
  const why =
    request.unreadable === 'expansion'
      ? 'the body is a shell expansion, so its text is not in the command'
      : request.unreadable === 'input'
        ? 'the body is on standard input'
        : 'the file could not be read (a path with `$` or `~`, or not found from the session directory)'
  return `Filing: ${why}. Write the issue to a file first and pass ${PASS[request.how]}, so it can be checked against docs/process/filing-checklist.md.`
}

/**
 * Why the Bash command may not run, or null: it creates an issue that fails the issue rules (with
 * the duplicate-search record), or whose body the hook cannot read.
 * @param {string} command
 * @param {{ policy: object, readFile: (file: string) => string }} context
 */
export function filingCheck(command, { policy, readFile }) {
  for (const request of filingRequests(command, readFile)) {
    if (request.unreadable) return unreadableReason(request)
    const issue = {
      body: request.body,
      labels: request.labels.map((name) => ({ name })),
      milestone: request.milestone ? { title: String(request.milestone) } : null,
      state: 'open',
    }
    const problems = issueProblems(issue, policy, { filing: true })
    if (problems.length) {
      const hint = /\$\(|\$\{/.test(request.body)
        ? '\nIf the body uses shell expansion, write it to a file and pass that file.'
        : ''
      return `Filing: this issue would fail the issue check. Fix each, then file it again (docs/process/filing-checklist.md):\n- ${problems.join('\n- ')}${hint}`
    }
  }
  return null
}
