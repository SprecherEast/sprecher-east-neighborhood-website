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
const ISSUES_ENDPOINT = /^\/?repos\/[^/]+\/[^/]+\/issues\/?$/

// What each flag of a gh command does, one table per command: the issue field it sets, `field` and
// `rawField` (a `key=value` of `gh api`, `-F` reading `@file`), `input`, `method`, or `ignored`.
// The flags that take a value are the table's keys, so a value is never mistaken for a word.
const API_FLAGS = {
  '-f': 'rawField',
  '--raw-field': 'rawField',
  '-F': 'field',
  '--field': 'field',
  '--input': 'input',
  '-X': 'method',
  '--method': 'method',
  ...Object.fromEntries(
    [
      '-H',
      '--header',
      '-q',
      '--jq',
      '-t',
      '--template',
      '--hostname',
      '--cache',
      '-p',
      '--preview',
    ].map((flag) => [flag, 'ignored']),
  ),
}
const CREATE_FLAGS = {
  '-t': 'title',
  '--title': 'title',
  '-b': 'body',
  '--body': 'body',
  '-F': 'bodyFile',
  '--body-file': 'bodyFile',
  '-l': 'labels',
  '--label': 'labels',
  '-m': 'milestone',
  '--milestone': 'milestone',
  ...Object.fromEntries(
    ['-a', '--assignee', '-p', '--project', '-T', '--template', '-R', '--repo', '--recover'].map(
      (flag) => [flag, 'ignored'],
    ),
  ),
}

/** The fields of an issue, as `POST /issues` names them (`gh api` writes `labels[]` for `labels`) */
/** The names `gh issue` answers to for creating an issue */
const CREATE_NAMES = ['create', 'new']

const ISSUE_FIELDS = ['title', 'body', 'labels', 'milestone']

/**
 * Splits a gh command's words into what its flags do (`[kind, value]`, from `table`) and its other
 * words. Reads `--flag value`, `--flag=value`, `-f value` and `-fvalue`; a switch has no kind.
 */
function parseFlags(words, table) {
  const flags = []
  const rest = []
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const equals = word.startsWith('--') ? word.indexOf('=') : -1
    const name = equals > 0 ? word.slice(0, equals) : word
    const short = !word.startsWith('--') && word.length > 2 ? word.slice(0, 2) : null
    if (name in table)
      flags.push([table[name], equals > 0 ? word.slice(equals + 1) : (words[++i] ?? ''), name])
    else if (short && short in table) flags.push([table[short], word.slice(2), short])
    else if (word.startsWith('-') && word.length > 1) flags.push([null, null, name])
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

/** A body that is wholly a shell expansion (`$(cat f)`): its text is not in the command */
const isExpansion = (value) => /^\s*(\$|`)/.test(value)

/** Reads a file argument's text, or marks the request unreadable and returns null */
function readText(request, file, readFile) {
  if (file === '-') request.unreadable = 'input'
  else if (/[$`]|^~/.test(file)) request.unreadable = 'path'
  else
    try {
      return readFile(file)
    } catch {
      request.unreadable = 'path'
    }
  return null
}

/**
 * Sets one issue field of the request. `body` is text typed in the command (a shell expansion
 * there is not its text), `bodyFile` is read from disk, `bodyText` is text already read.
 */
function setField(request, field, value, readFile) {
  if (field === 'labels')
    request.labels.push(
      ...value
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean),
    )
  else if (field === 'title' || field === 'milestone' || field === 'bodyText')
    request[field === 'bodyText' ? 'body' : field] = value
  else if (field === 'body') {
    if (isExpansion(value)) request.unreadable = 'expansion'
    else request.body = value
  } else if (field === 'bodyFile') {
    const text = readText(request, value, readFile)
    if (text != null) request.body = text
  }
}

/** The issue a `gh api` call posts, or null when it is not a POST to the issues endpoint */
function apiRequest(words, readFile) {
  const { flags, rest } = parseFlags(words.slice(2), API_FLAGS)
  const endpoint = (rest[0] ?? '').replace(/^https?:\/\/[^/]+/, '').split('?')[0]
  if (!ISSUES_ENDPOINT.test(endpoint)) return null
  const verb = flags.findLast(([kind]) => kind === 'method')?.[1]
  const sent = flags.filter(([kind]) => ['field', 'rawField', 'input'].includes(kind))
  if (verb ? verb.toUpperCase() !== 'POST' : !sent.length) return null
  const request = emptyRequest('api')
  for (const [kind, value] of sent) {
    if (kind === 'input') {
      const text = readText(request, value, readFile)
      if (text == null) continue
      try {
        const json = JSON.parse(text)
        for (const field of ISSUE_FIELDS)
          for (const item of [].concat(json[field] ?? []))
            setField(
              request,
              field === 'body' ? 'bodyText' : field,
              String(item?.name ?? item),
              readFile,
            )
      } catch {
        request.unreadable = 'json'
      }
      continue
    }
    const at = value.indexOf('=')
    const field = value.slice(0, at).replace(/\[\]$/, '')
    const text = value.slice(at + 1)
    if (at > 0 && field === 'body' && kind === 'field' && text.startsWith('@'))
      setField(request, 'bodyFile', text.slice(1), readFile)
    else if (at > 0 && ISSUE_FIELDS.includes(field)) setField(request, field, text, readFile)
  }
  return request
}

/** The issue a `gh issue create` call makes: `--web` opens the form, `--editor` is not visible */
function createRequest(flags, readFile) {
  if (flags.some(([, , name]) => ['-w', '--web', '-h', '--help'].includes(name))) return null
  const request = emptyRequest('create')
  if (flags.some(([, , name]) => ['-e', '--editor'].includes(name))) request.unreadable = 'editor'
  for (const [kind, value] of flags) setField(request, kind, value, readFile)
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
    const issue = words[1] === 'issue' ? parseFlags(words.slice(2), CREATE_FLAGS) : null
    const request = CREATE_NAMES.includes(issue?.rest[0])
      ? createRequest(issue.flags, readFile)
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
        : request.unreadable === 'json'
          ? 'the --input file is not valid JSON'
          : request.unreadable === 'editor'
            ? 'the body would be written in an editor, which the hook cannot see'
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
