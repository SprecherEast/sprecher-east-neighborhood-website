/**
 * The issue check's rules (#969): pure functions, so the workflow keeps only the API calls. The
 * check warns and never blocks (GitHub cannot stop an issue being filed): it keeps one comment
 * and the `needs grooming` label up to date. The rule IDs are listed in
 * docs/process/issue-and-pr-checks.md ("The issue check"), where the pull request gate's are too.
 */
import { formAnswers } from './issue-form.mjs'
import { labelNames, planGaps, ruleMessage } from './pr-body.mjs'

export const GROOMING_LABEL = 'needs grooming'
export const COMMENT_MARKER = '<!-- issue-policy -->'

/**
 * Sections of an issue body by heading, the last one winning. Issue forms write `###` headings and
 * hand-written issues often `##`, so levels 2 to 4 count.
 */
function issueSections(body) {
  return Object.fromEntries(
    formAnswers(body, { minLevel: 2, maxLevel: 4 }).map(({ title, text }) => [title, text]),
  )
}

/** An epic is a parent issue: it has no files or checkboxes of its own and never goes to In progress. */
const isEpic = (issue) => labelNames(issue).includes('epic')

// The forms call the plain-language statement "Problem"; hand-written issues say "Summary" or "Goal"
const SUMMARY_HEADINGS = ['summary', 'problem', 'goal']
const SUMMARY_MIN_LENGTH = 20

/** The one-line fix for each rule ID of the issue check, for the filing checklist (#971). */
export const ISSUE_RULE_FIXES = {
  'ISSUE-TYPE': 'Give the issue exactly one type label.',
  'ISSUE-AREA': 'Give the issue at least one area label.',
  'ISSUE-PRIORITY': 'Give the issue exactly one priority label (high, medium or low).',
  'ISSUE-SUMMARY':
    'Start with a "Problem" (or "Summary") section: a plain-language sentence or two.',
  'ISSUE-CRITERIA':
    'Add an "Acceptance criteria" section with at least one `- [ ]` checkbox that has text.',
  'ISSUE-FILES':
    'Fill in "Files likely touched" and "Must not touch" (write `None` when there is nothing).',
  'ISSUE-MILESTONE': 'Set a milestone (Backlog until planned); an epic is optional.',
}

/** The issue rules: ISSUE-TYPE, -AREA, -PRIORITY, -SUMMARY, -CRITERIA, -FILES and -MILESTONE. */
export function issueProblems(issue, policy) {
  // An epic is exempt, so one flagged before it became an epic is cleared on the next run
  if (isEpic(issue)) return []
  const gaps = planGaps(issue, policy)
  const sections = issueSections(issue.body)
  const problems = []

  if (gaps.types !== 1)
    problems.push(
      ruleMessage(
        'ISSUE-TYPE',
        `Give the issue exactly one type label (${policy.types.join(', ')}); it has ${gaps.types}.`,
      ),
    )
  if (!gaps.hasArea)
    problems.push(
      ruleMessage('ISSUE-AREA', `Add at least one area label (${policy.areas.join(', ')}).`),
    )
  if (gaps.priorities !== 1)
    problems.push(
      ruleMessage('ISSUE-PRIORITY', 'Give the issue one priority label (high, medium or low).'),
    )

  const summary = SUMMARY_HEADINGS.map((name) => sections[name] ?? '').join('')
  if (summary.replace(/\s/g, '').length < SUMMARY_MIN_LENGTH)
    problems.push(
      ruleMessage(
        'ISSUE-SUMMARY',
        'Add a "Problem" (or "Summary") section: a plain-language sentence or two.',
      ),
    )

  // A checkbox with words after it: an empty "- [ ]" is no criterion
  if (!/^[ \t]*[-*][ \t]+\[[ xX]\][ \t]+\S/m.test(sections['acceptance criteria'] ?? ''))
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

  if (!gaps.hasMilestone)
    problems.push(ruleMessage('ISSUE-MILESTONE', 'Set a milestone (Backlog until it is planned).'))

  return problems
}

/**
 * Why an issue is not checked, or null: pull requests, closed issues and bot-filed noise. (An
 * epic is checked but exempt from every rule, so its label and comment get cleared.)
 */
export function skipReason(issue) {
  if (issue.pull_request) return 'a pull request, which the PR Policy check covers'
  if (issue.state === 'closed') return 'a closed issue'
  if (issue.user?.type === 'Bot' || issue.user?.login?.endsWith('[bot]'))
    return 'filed by a bot (for example a dependency update)'
  return null
}

// Absolute, because a relative path does not resolve from an issue comment
const DOCS =
  'https://github.com/SprecherEast/sprecher-east-neighborhood-website/blob/main/docs/process/issue-and-pr-checks.md#the-issue-check'

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

/** Our own comment: written by Actions and starting with the marker, never anyone else's copy. */
function ownComment(comments) {
  return comments.find(
    (c) => c.user?.login === 'github-actions[bot]' && c.body?.startsWith(COMMENT_MARKER),
  )
}

/**
 * What to do so the comment and the label match the rules. It does nothing when they already do,
 * so a label event this check causes cannot start another run's worth of writes.
 */
export function groomingPlan({ problems, issue, comments }) {
  const failing = problems.length > 0
  const existing = ownComment(comments)
  const body = failing ? groomingComment(problems) : clearComment()

  let comment = { action: 'none' }
  if (existing && existing.body !== body) comment = { action: 'update', id: existing.id, body }
  else if (!existing && failing) comment = { action: 'create', body }

  const flagged = labelNames(issue).includes(GROOMING_LABEL)
  const label = failing && !flagged ? 'add' : !failing && flagged ? 'remove' : 'none'
  return { comment, label }
}
