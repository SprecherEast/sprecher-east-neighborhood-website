/**
 * The issue check's rules (#969): pure functions, so the workflow keeps only the API calls. The
 * check warns and never blocks (GitHub cannot stop an issue being filed): it keeps one comment
 * and the `needs grooming` label up to date. The rule IDs are listed in
 * docs/process/project-management.md ("The issue check"), where the pull request gate's are too.
 */
import { ruleMessage, withoutComments } from './pr-body.mjs'

export const GROOMING_LABEL = 'needs grooming'
export const COMMENT_MARKER = '<!-- issue-policy -->'

const labelNames = (issue) =>
  (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name))

const PLACEHOLDER = '_No response_'

/**
 * Sections of an issue body by lower-cased heading. Issue forms write `### Heading`; hand-written
 * issues often use `##`. Comments are removed first, so a hidden heading counts for nothing.
 */
function issueSections(body) {
  const sections = {}
  for (const part of withoutComments(body)
    .split(/^#{2,4}[ \t]+/m)
    .slice(1)) {
    const newline = part.indexOf('\n')
    const title = (newline === -1 ? part : part.slice(0, newline)).trim().toLowerCase()
    const text = newline === -1 ? '' : part.slice(newline + 1).trim()
    sections[title] = text === PLACEHOLDER ? '' : text
  }
  return sections
}

// The forms call the plain-language statement "Problem"; hand-written issues say "Summary" or "Goal"
const SUMMARY_HEADINGS = ['summary', 'problem', 'goal']
const SUMMARY_MIN_LENGTH = 20

/** The issue rules: ISSUE-TYPE, -AREA, -PRIORITY, -SUMMARY, -CRITERIA, -FILES and -MILESTONE. */
export function issueProblems(issue, policy) {
  const labels = labelNames(issue)
  const sections = issueSections(issue.body)
  const problems = []

  const types = labels.filter((label) => policy.types.includes(label))
  if (types.length !== 1)
    problems.push(
      ruleMessage(
        'ISSUE-TYPE',
        `Give the issue exactly one type label (${policy.types.join(', ')}); it has ${types.length}.`,
      ),
    )
  if (!labels.some((label) => policy.areas.includes(label)))
    problems.push(
      ruleMessage('ISSUE-AREA', `Add at least one area label (${policy.areas.join(', ')}).`),
    )
  if (labels.filter((label) => label.startsWith('priority: ')).length !== 1)
    problems.push(
      ruleMessage('ISSUE-PRIORITY', 'Give the issue one priority label (high, medium or low).'),
    )

  const summary = SUMMARY_HEADINGS.map((name) => sections[name] ?? '').join('')
  if (summary.replace(/\s/g, '').length < SUMMARY_MIN_LENGTH)
    problems.push(
      ruleMessage('ISSUE-SUMMARY', 'Add a "Summary" section: a plain-language sentence or two.'),
    )

  if (!/^[ \t]*[-*][ \t]+\[[ xX]\]/m.test(sections['acceptance criteria'] ?? ''))
    problems.push(
      ruleMessage(
        'ISSUE-CRITERIA',
        'Add an "Acceptance criteria" section with at least one "- [ ]" checkbox.',
      ),
    )

  if (!sections['files likely touched'] || !sections['must not touch'])
    problems.push(
      ruleMessage(
        'ISSUE-FILES',
        'Fill in "Files likely touched" and "Must not touch" (write None when there is nothing).',
      ),
    )

  if (!issue.milestone)
    problems.push(ruleMessage('ISSUE-MILESTONE', 'Set a milestone (Backlog until it is planned).'))

  return problems
}

/** Why an issue is not checked, or null: pull requests, closed issues and bot-filed noise. */
export function skipReason(issue) {
  if (issue.pull_request) return 'a pull request, which the PR Policy check covers'
  if (issue.state === 'closed') return 'a closed issue'
  if (issue.user?.type === 'Bot' || issue.user?.login?.endsWith('[bot]'))
    return 'filed by a bot (for example a dependency update)'
  return null
}

const DOCS = 'docs/process/project-management.md#the-issue-check'

/** The one comment on a failing issue: each failed rule with its fix. */
export function groomingComment(problems) {
  return [
    COMMENT_MARKER,
    `### Needs grooming`,
    '',
    `This issue is missing something the Definition of Ready needs, so it carries the \`${GROOMING_LABEL}\` label. Nothing is blocked; fix each item and this comment and the label update themselves ([the rules](${DOCS})).`,
    '',
    ...problems.map((problem) => `- ${problem}`),
  ].join('\n')
}

/** The same comment once everything passes. */
export function clearComment() {
  return [
    COMMENT_MARKER,
    `### Groomed`,
    '',
    `Every issue rule passes, so the \`${GROOMING_LABEL}\` label is gone ([the rules](${DOCS})).`,
  ].join('\n')
}

/** Our own comment: written by Actions (a bot) and starting with the marker, never a person's copy. */
function ownComment(comments) {
  return comments.find((c) => c.user?.type === 'Bot' && c.body?.startsWith(COMMENT_MARKER))
}

/**
 * What to do so the comment and the label match the rules. It does nothing when they already do,
 * so a label event this check causes cannot start another run's worth of writes.
 */
export function groomingPlan({ problems, labels, comments }) {
  const failing = problems.length > 0
  const existing = ownComment(comments)
  const body = failing ? groomingComment(problems) : clearComment()

  let comment = { action: 'none' }
  if (existing && existing.body !== body) comment = { action: 'update', id: existing.id, body }
  else if (!existing && failing) comment = { action: 'create', body }

  const flagged = labels.includes(GROOMING_LABEL)
  const label = failing && !flagged ? 'add' : !failing && flagged ? 'remove' : 'none'
  return { comment, label }
}
