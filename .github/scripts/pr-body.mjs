/**
 * Reads a pull request description: the one parser for the `PR Policy` and `Issue Fix Summary`
 * workflows and the knowledge-sync check (#716), so comments, sections and linked issues are
 * read in one place.
 */

/**
 * The description without its HTML comments (the template's instructions). A comment that is
 * never closed hides the rest, as Markdown renders it. Removing one comment can join the halves
 * of another (`<!<!-- x -->-- y -->`), so it repeats until nothing changes and no `<!--` is left
 * for a reader to treat as hidden text.
 */
export function withoutComments(body) {
  let text = (body ?? '').replace(/\r\n?/g, '\n')
  for (let previous = null; previous !== text; ) {
    previous = text
    text = text.replace(/<!--[\s\S]*?(?:-->|$)/g, '')
  }
  return text
}

/**
 * The sections of a description: each heading of level 2 up to `maxLevel` (2 by default, the PR
 * template's), lower-cased, mapped to the text under it. Issue forms write `###` headings, so the
 * issue check passes 4.
 */
export function sectionsOf(body, { maxLevel = 2 } = {}) {
  const sections = {}
  for (const part of withoutComments(body)
    .split(new RegExp(`^#{2,${maxLevel}}\\s+`, 'm'))
    .slice(1)) {
    const newline = part.indexOf('\n')
    const title = (newline === -1 ? part : part.slice(0, newline)).trim().toLowerCase()
    sections[title] = newline === -1 ? '' : part.slice(newline + 1)
  }
  return sections
}

/**
 * The issues a description links: `closes` for "Closes/Fixes/Resolves #N", `partOf` for
 * "Part of #N" (an issue that also closes isn't listed again). Links inside comments don't count.
 */
export function linkedIssues(body) {
  const text = withoutComments(body)
  const numbers = (re) => [...new Set([...text.matchAll(re)].map((match) => Number(match[1])))]
  const closes = numbers(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+#(\d+)\b/gi)
  const partOf = numbers(/\bpart of:?\s+#(\d+)\b/gi).filter((number) => !closes.includes(number))
  return { closes, partOf }
}

/**
 * The PR gate's rules (#970). Every failure starts with a stable ID, so it can be counted and the
 * next attempt knows which rule to fix: PR-CLOSES, PR-LINKED, PR-LABELS, PR-ASSIGNED,
 * PR-MILESTONE, PR-SECTIONS, PR-SELF-REVIEW, PR-KNOWLEDGE and PR-E2E.
 */
export function ruleMessage(id, text) {
  return `${id}: ${text}`
}

/** PR-CLOSES: the description closes exactly one issue; "Part of" no longer counts. */
export function closeProblems({ closes, partOf }) {
  if (partOf.length > 0)
    return [
      ruleMessage(
        'PR-CLOSES',
        'Replace "Part of #N" with "Closes #N" for the one issue this PR finishes (split bigger work into sub-issues).',
      ),
    ]
  if (closes.length === 0)
    return [ruleMessage('PR-CLOSES', 'Add "Closes #N" for the issue this PR addresses.')]
  if (closes.length > 1)
    return [
      ruleMessage(
        'PR-CLOSES',
        'Close exactly one issue: keep one "Closes #N" and give the rest their own PRs.',
      ),
    ]
  return []
}

/** The names of an issue's labels, whether the API gave label objects or plain strings. */
export function labelNames(issue) {
  return (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name))
}

/**
 * What an issue has of the plan's labels and milestone: the one reading both gates (`PR Policy`
 * and `Issue Policy`) use, each with its own IDs and wording. `types` and `priorities` are counts
 * so a gate can ask for exactly one or at least one. The PR gate takes one or more priority
 * labels, since a pull request is not worth blocking over a second one; the issue check asks for
 * exactly one, because two priorities is a ranking nobody can read.
 */
export function planGaps(issue, policy) {
  const labels = labelNames(issue)
  return {
    types: labels.filter((label) => policy.types.includes(label)).length,
    hasArea: labels.some((label) => policy.areas.includes(label)),
    priorities: labels.filter((label) => label.startsWith('priority: ')).length,
    hasMilestone: Boolean(issue.milestone),
  }
}

/** PR-LABELS, PR-ASSIGNED and PR-MILESTONE: what the closed issue needs (an epic is optional). */
export function issueProblems(number, issue, policy) {
  const gaps = planGaps(issue, policy)
  const problems = []
  if (gaps.types !== 1)
    problems.push(
      ruleMessage(
        'PR-LABELS',
        `Give issue #${number} exactly one type label (${policy.types.join(', ')}); it has ${gaps.types}.`,
      ),
    )
  if (!gaps.hasArea)
    problems.push(
      ruleMessage(
        'PR-LABELS',
        `Give issue #${number} at least one area label (${policy.areas.join(', ')}).`,
      ),
    )
  if (gaps.priorities === 0)
    problems.push(
      ruleMessage(
        'PR-LABELS',
        `Give issue #${number} a priority label (priority: high / medium / low).`,
      ),
    )
  if (!issue.assignees?.length)
    problems.push(
      ruleMessage(
        'PR-ASSIGNED',
        `Assign issue #${number} (assigning is how its card moves to In progress).`,
      ),
    )
  if (!gaps.hasMilestone)
    problems.push(
      ruleMessage(
        'PR-MILESTONE',
        `Give issue #${number} a milestone (Backlog if it is not planned yet).`,
      ),
    )
  return problems
}

/** PR-LINKED: the issue's timeline shows this PR, so the link works from both sides. */
export function timelineShowsPr(events, prNumber) {
  // A `connected` event (a manual link) carries no `source` in the REST timeline, so only the
  // cross-reference a closing keyword creates can name this PR
  return events.some(
    (event) =>
      event.event === 'cross-referenced' &&
      event.source?.issue?.pull_request &&
      event.source.issue.number === prNumber,
  )
}

/** The ID in front of each problem another check reports (PR-KNOWLEDGE, PR-E2E). */
export function withRuleId(id, problems) {
  return problems.map((problem) => ruleMessage(id, problem))
}

/** Dependabot pull requests are exempt from the issue and description rules (AGENTS.md). */
export function isDependabot(pr) {
  return pr.user.login === 'dependabot[bot]'
}

/** PR-CLOSES: the number after "Closes" must be an issue that exists (`issue` is null if not). */
export function lookupProblems(number, issue) {
  if (!issue)
    return [ruleMessage('PR-CLOSES', `#${number} was not found; close an issue that exists.`)]
  if (issue.pull_request)
    return [
      ruleMessage(
        'PR-CLOSES',
        `#${number} is a pull request, not an issue; close the issue instead.`,
      ),
    ]
  return []
}

const SECTION_NAMES = [
  'What changed',
  'Why',
  'How',
  'How to test',
  'Risk & rollback',
  'Self-review',
]
const SELF_REVIEW_ITEMS = ['Reuse', 'Quality', 'Efficiency', 'Guidelines', 'Visual']

/** PR-SECTIONS and PR-SELF-REVIEW: every template section is filled in. */
export function descriptionProblems(body) {
  const sections = sectionsOf(body)
  const problems = []
  for (const name of SECTION_NAMES) {
    const text = (sections[name.toLowerCase()] || '').replace(/^\s*\d+\.\s*$/gm, '').trim()
    if (text.length < 10)
      problems.push(
        ruleMessage('PR-SECTIONS', `Fill in the "## ${name}" section of the PR description.`),
      )
  }
  // The self-review (docs/guidelines/guard-rails.md, rule 6) says something about each item
  const selfReview = sections['self-review'] || ''
  for (const item of SELF_REVIEW_ITEMS) {
    const line = selfReview
      .split('\n')
      .find((l) => new RegExp(`^\\s*[-*]\\s*\\**${item}\\**\\s*:`, 'i').test(l))
    const answer = (line || '').replace(/^[^:]*:/, '').trim()
    if (answer.length < 10)
      problems.push(
        ruleMessage(
          'PR-SELF-REVIEW',
          `Write a line "- ${item}: what you checked and fixed" (10+ characters) under "## Self-review".`,
        ),
      )
  }
  return problems
}
