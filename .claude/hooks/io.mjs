// What the hooks share (#446): reading the hook's JSON input, finding the repository a path
// belongs to, the per-session reminders (#717), and running a tool from that repository's
// node_modules without a shell.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** The hook input, or null when stdin isn't JSON (then the hook does nothing) */
export function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || 'null')
  } catch {
    return null
  }
}

/** Runs git in `cwd`; '' when git fails (not a repository, no such ref) */
export function git(cwd, ...args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

/** The top of the git checkout or worktree that holds `dir`, or null */
export function repoRoot(dir) {
  return git(dir, 'rev-parse', '--show-toplevel') || null
}

/** Where a session's list of reminded notes is kept: one small file per session */
export function remindedFile(sessionId, dir) {
  return path.join(dir, `reminded-${String(sessionId).replace(/[^\w-]/g, '_')}.json`)
}

/**
 * The folder for the hook's per-session state: inside the clone's own git folder, so it belongs to
 * the user who owns the clone, is not shared like the temp folder, and goes away with the clone.
 */
export function stateDir(root) {
  const common = git(root, 'rev-parse', '--git-common-dir')
  return common ? path.join(path.resolve(root, common), 'sprecher-east') : null
}

/** The notes this session was already reminded about (empty when unknown or unreadable) */
export function remindedNotes(sessionId, dir) {
  try {
    return new Set(JSON.parse(readFileSync(remindedFile(sessionId, dir), 'utf8')))
  } catch {
    return new Set()
  }
}

/**
 * Remembers that this session was reminded about `note`. It writes a new file and renames it into
 * place, so a symlink planted at the file's name is replaced, never written through. A failure
 * only means a second reminder.
 */
export function markReminded(sessionId, note, dir) {
  try {
    const file = remindedFile(sessionId, dir)
    const notes = remindedNotes(sessionId, dir).add(note)
    mkdirSync(dir, { recursive: true })
    const temporary = `${file}.${process.pid}.tmp`
    writeFileSync(temporary, JSON.stringify([...notes]), { flag: 'wx' })
    renameSync(temporary, file)
  } catch {
    // Worst case the reminder shows again
  }
}

/**
 * Whether `note` differs from where this branch left `main` (committed, staged, edited or new).
 * True when that can't be told (no `main`, a shallow clone), so the hook stays quiet rather than
 * nag wrongly. It compares with `main`, not with the branch below in a stack. Runs 3 to 5 git
 * commands (typically 4), uncached.
 */
export function noteChangedSinceMain(root, note) {
  const main = ['origin/main', 'main'].find((ref) => git(root, 'rev-parse', '--verify', '-q', ref))
  const base = main && git(root, 'merge-base', 'HEAD', main)
  if (!base) return true
  return (
    git(root, '--literal-pathspecs', 'diff', '--name-only', base, '--', note) !== '' ||
    git(root, '--literal-pathspecs', 'ls-files', '--others', '--exclude-standard', '--', note) !==
      ''
  )
}

/** Where each tool's command-line script sits inside node_modules */
const BINS = {
  prettier: 'node_modules/prettier/bin/prettier.cjs',
  eslint: 'node_modules/eslint/bin/eslint.js',
}

/** Runs a tool from `root`'s node_modules with Node, or returns null when it isn't installed */
export function runTool(root, tool, args) {
  const bin = path.join(root, BINS[tool])
  if (!existsSync(bin)) return null
  return spawnSync(process.execPath, [bin, ...args], { cwd: root, encoding: 'utf8' })
}
