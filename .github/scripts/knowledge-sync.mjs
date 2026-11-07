/**
 * The knowledge sync rule (decision 0019, section 6; #716): a pull request that changes code under
 * a path the knowledge map lists must change that path's note, or declare
 * `Behavior change: none` with a reason. Run by the `PR Policy` workflow.
 *
 * The glob matching and the map parsing are the ones `scripts/agent-context-maps.mjs` already has (it
 * reads the same map to load the notes), so they are imported, not written a second time.
 */
import { describes, parseKnowledgeMap } from '../../scripts/agent-context-maps.mjs'
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
 * Every path a pull request touches, from GitHub's file list: a rename gives its old path too, so
 * moving a file out of a mapped folder still asks for the note. Throws on a list that may have
 * been cut short, so the gate fails instead of passing on part of the diff.
 */
export function changedPaths(files) {
  if (files.length >= LIST_FILES_LIMIT) {
    throw new Error(
      `This PR changes ${LIST_FILES_LIMIT} files or more, more than GitHub lists, so the knowledge check can't see them all. Split the PR.`,
    )
  }
  return files.flatMap((file) => [file.filename, file.previous_filename].filter(Boolean))
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
 * The problems with a pull request, one per note it should have updated (an empty list when it is
 * in sync). Only entries whose note exists are enforced, so each note's rollout adds its own.
 *
 * @param {object} input
 * @param {string} input.mapJson contents of docs/knowledge/map.json
 * @param {string[]} input.changedFiles every path the PR touches, a rename's old path included
 * @param {(note: string) => boolean} input.noteExists
 * @param {string} input.body the PR description
 */
export function knowledgeProblems({ mapJson, changedFiles, noteExists, body }) {
  const declared = declaredBehavior(body)
  const problems = []
  for (const entry of parseKnowledgeMap(mapJson)) {
    const note = entry.source
    if (!noteExists(note) || changedFiles.includes(note)) continue
    const touched = changedFiles.filter((file) => describes(entry, file))
    if (touched.length === 0) continue
    if (declared?.change === 'none' && declared.reason.length >= MIN_REASON_LENGTH) continue

    const shown =
      touched.slice(0, 3).join(', ') + (touched.length > 3 ? ` and ${touched.length - 3} more` : '')
    const how =
      declared?.change === 'yes'
        ? 'The Knowledge section says "Behavior change: yes", so the note must change with it.'
        : declared?.change === 'none'
          ? `"Behavior change: none" needs a reason of at least ${MIN_REASON_LENGTH} characters.`
          : `Or write "Behavior change: none" and a reason of at least ${MIN_REASON_LENGTH} characters under "## Knowledge".`
    problems.push(
      `This PR changes ${shown}, which \`${note}\` describes. Update \`${note}\` in this PR. ${how}`,
    )
  }
  return problems
}
