/**
 * The knowledge sync rule (decision 0019, section 6; #716, #770): a pull request that changes
 * anything that can alter behavior, anywhere in the repository, must change a note, a reference or
 * a doc, or declare `Behavior change: none` with a reason. What can alter behavior is decided by
 * the classifier in `scripts/behavior-change.mjs` (tests, comment-only and formatting-only diffs,
 * docs and lockfile patches don't). Where `docs/knowledge/map.json` names a note for a changed
 * path, that note itself must change. Run by the `PR Policy` workflow.
 *
 * The glob matching and the map parsing are the ones `scripts/agent-context-maps.mjs` already has (it
 * reads the same map to load the notes), so they are imported, not written a second time.
 */
import { describes, parseKnowledgeMap } from '../../scripts/agent-context-maps.mjs'
import { classifyChanges } from '../../scripts/behavior-change.mjs'
import { sectionsOf } from './pr-body.mjs'

/** The shortest reason a "none" declaration needs. */
export const MIN_REASON_LENGTH = 20

// Matched on a line with `*`, `_` and runs of spaces already reduced (see `plain`), so the
// patterns stay linear: nothing here can backtrack on a long line of spaces or asterisks.
const DECLARATION = /^(?:- )?behavior change ?:? ?(yes|none)\b ?[-–—:.,]? ?(.*)$/i
const BLANK_DECLARATION = /^(?:- )?behavior change\b/i

/** A line without Markdown emphasis, and with each run of white space as one space. */
const plain = (line) => line.replace(/[*_]/g, '').replace(/\s+/g, ' ').trim()

/** GitHub's `pulls.listFiles` stops at this many files, so a list this long may be incomplete. */
export const LIST_FILES_LIMIT = 3000

/**
 * The files of a pull request, from GitHub's file list. Throws on a list that may have been cut
 * short, so the gate fails instead of passing on part of the diff.
 */
export function changedFiles(files) {
  if (files.length >= LIST_FILES_LIMIT) {
    throw new Error(
      `This PR changes ${LIST_FILES_LIMIT} files or more, more than GitHub lists, so the knowledge check can't see them all. Split the PR.`,
    )
  }
  return files
}

/**
 * What the Knowledge section of a description declares: `{ change: 'yes' | 'none', reason }`, with
 * the reason read from the rest of the line and the lines that follow it. Null when the section or
 * the line is missing, or the line says neither.
 */
export function declaredBehavior(body) {
  const lines = (sectionsOf(body).knowledge ?? '').split('\n').map(plain)
  const start = lines.findIndex((line) => DECLARATION.test(line))
  if (start === -1) return null
  const [, change, rest] = lines[start].match(DECLARATION)
  const following = lines.slice(start + 1).filter((line) => !BLANK_DECLARATION.test(line))
  return { change: change.toLowerCase(), reason: [rest, ...following].join(' ').trim() }
}

/**
 * The documents the Knowledge section names by path: a word with a slash that ends in `.md` or
 * `.mdx`, or starts with `docs/` and has a file extension. A folder (`docs/reference`) is not one.
 * Read word by word, so nothing here can backtrack on a long line.
 */
export function namedDocs(body) {
  const names = new Set()
  for (const word of (sectionsOf(body).knowledge ?? '').split(/[\s`'"<>,;:()[\]]+/)) {
    const path = word.replace(/^\.\//, '').replace(/[.!?]+$/, '')
    if (!/^[\w./@-]+$/.test(path) || !path.includes('/')) continue
    if (/\.mdx?$/i.test(path) || (path.startsWith('docs/') && /\.\w+$/.test(path))) {
      names.add(path)
    }
  }
  return [...names]
}

const shown = (paths) =>
  paths.slice(0, 3).join(', ') + (paths.length > 3 ? ` and ${paths.length - 3} more` : '')

/** How to put it right, from what the description declares */
function howToFix(declared) {
  if (declared?.change === 'yes') {
    return 'The Knowledge section says "Behavior change: yes", so a note or doc must change with it.'
  }
  if (declared?.change === 'none') {
    return `"Behavior change: none" needs a reason of at least ${MIN_REASON_LENGTH} characters.`
  }
  return `Or write "Behavior change: none" and a reason of at least ${MIN_REASON_LENGTH} characters under "## Knowledge".`
}

/**
 * The problems with a pull request (an empty list when it is in sync): one per mapped note it
 * should have updated, and one when behavior-bearing files changed and no doc did. A "none"
 * declaration with a reason meets both. Only map entries whose note exists are enforced.
 *
 * @param {object} input
 * @param {string} input.mapJson contents of docs/knowledge/map.json
 * @param {object[]} input.files the PR's files as GitHub lists them (`filename`, `previous_filename`, `status`, `patch`)
 * @param {(note: string) => boolean} input.noteExists
 * @param {string} input.body the PR description
 */
export function knowledgeProblems({ mapJson, files, noteExists, body }) {
  const { behavior, docs } = classifyChanges(files)
  const declared = declaredBehavior(body)
  const pathsOf = (list) => list.flatMap((f) => [f.filename, f.previous_filename].filter(Boolean))
  const changedPaths = pathsOf(files)

  // A description that says a doc was updated must be telling the truth, whatever else changed
  const problems =
    declared?.change === 'none'
      ? []
      : namedDocs(body)
          .filter((doc) => !changedPaths.includes(doc))
          .map(
            (doc) =>
              `The Knowledge section names \`${doc}\`, but this PR does not change it. Update it in this PR, or correct the description.`,
          )
  if (behavior.length === 0) return problems
  if (declared?.change === 'none' && declared.reason.length >= MIN_REASON_LENGTH) return problems

  const behaviorPaths = pathsOf(behavior)
  const covered = new Set()
  for (const entry of parseKnowledgeMap(mapJson)) {
    const note = entry.source
    if (!noteExists(note) || changedPaths.includes(note)) continue
    const touched = behaviorPaths.filter((path) => describes(entry, path))
    if (touched.length === 0) continue
    for (const file of behavior) {
      if (pathsOf([file]).some((path) => touched.includes(path))) covered.add(file.filename)
    }
    problems.push(
      `This PR changes ${shown(touched)}, which \`${note}\` describes. Update \`${note}\` in this PR. ${howToFix(declared)}`,
    )
  }

  const uncovered = behavior.map((file) => file.filename).filter((path) => !covered.has(path))
  if (uncovered.length > 0 && docs.length === 0) {
    problems.push(
      `This PR changes ${shown(uncovered)}, which can change behavior, and no note, reference or doc changed with it. Update the one that describes it (a note, a guideline in \`docs/guidelines/\`, \`docs/project.md\`, the generated \`docs/reference/\`). ${howToFix(declared)}`,
    )
  }
  return problems
}
