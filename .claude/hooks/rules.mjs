// The checks the Claude Code hooks run (#446). Pure functions, tested in rules.test.mjs; the hook
// scripts beside this file only read stdin, ask git, and call them. CI stays the real gate: these
// catch the same mistakes earlier, inside the session that makes them.
import { describes, parseKnowledgeMap } from '../../scripts/agent-context-maps.mjs'
import { classifyFile } from '../../scripts/behavior-change.mjs'

/**
 * Splits a shell command into simple commands (at `;`, `&&`, `||`, `|` and new lines), each a list
 * of words with quotes removed. Enough for the commands agents type; not a full shell parser.
 * @param {string} command
 * @returns {string[][]}
 */
export function parseCommands(command) {
  const commands = []
  let words = []
  let word = ''
  let inWord = false
  let quote = null
  const endWord = () => {
    if (inWord) words.push(word)
    word = ''
    inWord = false
  }
  const endCommand = () => {
    endWord()
    if (words.length) commands.push(words)
    words = []
  }
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (quote) {
      if (c === quote) quote = null
      else if (c === '\\' && quote === '"' && i + 1 < command.length) word += command[++i]
      else word += c
    } else if (c === '"' || c === "'") {
      quote = c
      inWord = true
    } else if (c === '\\' && i + 1 < command.length) {
      word += command[++i]
      inWord = true
    } else if (c === ' ' || c === '\t') endWord()
    else if (c === ';' || c === '\n' || c === '|' || c === '&') {
      endCommand()
      if ((c === '&' || c === '|') && command[i + 1] === c) i++
    } else {
      word += c
      inWord = true
    }
  }
  endCommand()
  return commands
}

/** The git subcommand and its arguments, skipping `git -C <dir>` and `-c key=value`; else null */
function gitArgs(words) {
  if (words[0] !== 'git') return null
  let i = 1
  while (i < words.length && (words[i] === '-C' || words[i] === '-c')) i += 2
  return { sub: words[i], args: words.slice(i + 1) }
}

/** Branch names a push must never update */
const PROTECTED = new Set(['main', 'master'])

/** The branch a push refspec updates: `+HEAD:refs/heads/main` → `main` */
function pushTarget(refspec) {
  const destination = refspec.includes(':') ? refspec.slice(refspec.indexOf(':') + 1) : refspec
  return destination.replace(/^\+/, '').replace(/^refs\/heads\//, '')
}

/**
 * What a `git push` does: whether it names a protected branch, and whether it names no branch at
 * all (then it pushes the current one, which the caller checks).
 * @param {string[]} args the words after `push`
 */
export function readPush(args) {
  const positional = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--delete' || arg === '-d') continue
    if (arg === '-o' || arg === '--push-option' || arg === '--repo') {
      i++
      continue
    }
    if (arg.startsWith('-')) continue
    positional.push(arg)
  }
  const refspecs = positional.slice(1)
  return {
    protectedTarget: refspecs.some((refspec) => PROTECTED.has(pushTarget(refspec))),
    noRefspec: refspecs.length === 0,
  }
}

/** What a `git commit` does: whether it stages every tracked change itself (`-a`, `--all`) */
export function readCommit(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (['-m', '--message', '-F', '--file', '-C', '-c', '--author', '--date'].includes(arg)) {
      i++
      continue
    }
    if (arg === '--all') return { all: true }
    if (/^-[a-zA-Z]+$/.test(arg)) {
      // A cluster like `-am`: the letters before `m` are flags; what follows `m` is its value
      const flags = arg.slice(1).split(/[mFC]/)[0]
      if (flags.includes('a')) return { all: true }
      if (/[mFC]$/.test(arg)) i++
    }
  }
  return { all: false }
}

/**
 * The commands AGENTS.md forbids ("Never") that a Bash command contains, with the reason shown to
 * the agent, plus what the caller must check against git: pushes that name no branch, and commits.
 * @param {string} command
 */
export function inspect(command) {
  const result = { reason: null, barePush: false, commits: [] }
  if (typeof command !== 'string') return result
  for (const words of parseCommands(command)) {
    if (
      words[0] === 'gh' &&
      words[1] === 'pr' &&
      words[2] === 'merge' &&
      words.includes('--admin')
    ) {
      result.reason ??=
        'AGENTS.md: never merge with --admin; merge with rules enforced (bypass_rules: false).'
    }
    if (words[0] === 'gh' && words.some((word) => /^bypass_rules=true$/.test(word))) {
      result.reason ??= 'AGENTS.md: never bypass a rule; merge with bypass_rules: false.'
    }
    const git = gitArgs(words)
    if (git?.sub === 'push') {
      const push = readPush(git.args)
      if (push.protectedTarget) {
        result.reason ??= 'AGENTS.md: never push to main; work on a branch and open a pull request.'
      }
      if (push.noRefspec) result.barePush = true
    }
    if (git?.sub === 'commit') result.commits.push(readCommit(git.args))
  }
  // A JSON body piped to `gh api`, such as `{"bypass_rules": true}`
  if (/"bypass_rules"\s*:\s*true\b/.test(command) && /\bgh\s+api\b/.test(command)) {
    result.reason ??= 'AGENTS.md: never bypass a rule; merge with bypass_rules: false.'
  }
  return result
}

/**
 * The reminder for an edit to `file` (#717, decision 0019 §6): when the knowledge map lists a note
 * for it, the note exists (`noteExists`), is unchanged (`noteChanged`) and this session wasn't
 * reminded about it yet (`reminded`). The map is read and matched by the same helpers the loader
 * and CI use. Null when
 * there is nothing to say; throws on a map it can't read, which the hook ignores.
 * @param {{ file: string, mapJson: string, reminded: Set<string>, noteExists: (note: string) => boolean, noteChanged: (note: string) => boolean }} input
 */
export function knowledgeReminder({ file, mapJson, reminded, noteExists, noteChanged }) {
  for (const entry of parseKnowledgeMap(mapJson)) {
    const note = entry.source
    if (file === note || reminded.has(note) || !describes(entry, file)) continue
    if (!noteExists(note) || noteChanged(note)) continue
    return {
      note,
      message:
        `Knowledge: ${file} is described by ${note}, which has no change on this branch yet. ` +
        'If behavior changed (what a visitor, an editor or an agent gets), update the note in ' +
        'this PR; if not, the PR says "Behavior change: none" and why. Decision 0019 §6. ' +
        'Said once per module per session; CI checks.',
    }
  }
  return null
}

/** What the session remembers once the repository-wide behavior reminder was shown */
export const BEHAVIOR_REMINDER_KEY = '(repository)'

/**
 * The repository-wide reminder for an edit to `file` (#770, decision 0019 §6): when the file can
 * change behavior (the classifier in `scripts/behavior-change.mjs`, by path only, as the diff isn't
 * known yet), no doc has changed on this branch (`docChanged`, asked last, as it runs git) and this
 * session wasn't reminded yet. CI is the gate; this only says so earlier.
 * @param {{ file: string, reminded: Set<string>, docChanged: () => boolean }} input
 */
export function behaviorReminder({ file, reminded, docChanged }) {
  if (reminded.has(BEHAVIOR_REMINDER_KEY)) return null
  if (classifyFile({ filename: file, status: 'modified' }).kind !== 'behavior') return null
  if (docChanged()) return null
  return {
    note: BEHAVIOR_REMINDER_KEY,
    message:
      `Knowledge: ${file} can change behavior and no note, reference or doc has changed on this ` +
      'branch yet. If behavior changed (what a visitor, an editor or an agent gets), update the ' +
      'doc that describes it in this PR; if not, the PR says "Behavior change: none" and why ' +
      '(20+ characters). Decision 0019 §6. Said once per session; CI checks.',
  }
}

/** The generated types file that `next dev` rewrites without Prettier */
export const GENERATED_TYPES = 'src/payload-types.ts'

/** Files the after-edit hook formats, and the subset ESLint also checks */
const FORMAT = /\.(tsx?|jsx?|mjs|cjs|json|css|md|ya?ml)$/
const LINT = /\.(tsx?|jsx?|mjs)$/

/** @param {string} file */
export function shouldFormat(file) {
  return typeof file === 'string' && FORMAT.test(file)
}

/** @param {string} file */
export function shouldLint(file) {
  return typeof file === 'string' && LINT.test(file)
}

/** The line a browser script carries once the image review was done (#812) */
export const IMAGE_REVIEW_MARKER = 'image-review: passed'

const MEDIA_UPLOAD = /\/api\/media\b/
const IMAGE_ASSIGN =
  /\/api\/(?:events|posts|pages)\/[^\s'"`]*[\s\S]*\b(?:heroImage|meta\s*:[\s\S]*\bimage)\b/

/**
 * The refusal for a browser script that publishes an image (#812): an upload to `/api/media`, or a
 * change that sets a record's hero or meta image, without the line saying the image review
 * (`visual-design-review`, "Images made for the site") was done. Null when it may run.
 * @param {string} script
 */
export function imagePublishCheck(script) {
  if (typeof script !== 'string' || script.includes(IMAGE_REVIEW_MARKER)) return null
  if (!MEDIA_UPLOAD.test(script) && !IMAGE_ASSIGN.test(script)) return null
  return (
    'Image review first (#812): this script publishes an image. Review the finished image against ' +
    'docs/guidelines/ui-ux-design.md "Images made for the site": the area the layout overlays is ' +
    'empty, text is legible at phone card size, nothing repeats the title or date, no filler. Then ' +
    `add a comment line "${IMAGE_REVIEW_MARKER}" to the script and run it again.`
  )
}
