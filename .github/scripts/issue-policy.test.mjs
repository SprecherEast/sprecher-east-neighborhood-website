import { describe, expect, it } from 'vitest'

import {
  COMMENT_MARKER,
  GROOMING_LABEL,
  clearComment,
  groomingComment,
  groomingPlan,
  issueProblems,
  skipReason,
} from './issue-policy.mjs'

const policy = {
  types: ['bug', 'enhancement', 'documentation', 'tech-debt', 'process'],
  areas: ['frontend', 'ci', 'tooling'],
}

const GROOMED_BODY = `### Summary

When someone files an issue, a free check says what is missing.

### Acceptance criteria

- [ ] A new issue missing an item gets one comment.

### Files likely touched

\`.github/scripts/issue-policy.mjs\`

### Must not touch

None
`

const groomed = (overrides = {}) => ({
  number: 1,
  state: 'open',
  user: { login: 'someone', type: 'User' },
  labels: [{ name: 'process' }, { name: 'ci' }, { name: 'priority: high' }],
  milestone: { title: 'Backlog' },
  body: GROOMED_BODY,
  ...overrides,
})

const ids = (issue) => issueProblems(issue, policy).map((problem) => problem.split(':')[0])

describe('issueProblems', () => {
  it('passes a fully groomed issue', () => {
    expect(issueProblems(groomed(), policy)).toEqual([])
  })

  it('shows every rule for an issue with nothing but a title', () => {
    const bare = groomed({ labels: [], milestone: null, body: null })
    expect(ids(bare)).toEqual([
      'ISSUE-TYPE',
      'ISSUE-AREA',
      'ISSUE-PRIORITY',
      'ISSUE-SUMMARY',
      'ISSUE-CRITERIA',
      'ISSUE-FILES',
      'ISSUE-MILESTONE',
    ])
  })

  it('gives each failure a one-line fix after its ID', () => {
    const bare = groomed({ labels: [], milestone: null, body: '' })
    for (const problem of issueProblems(bare, policy)) {
      expect(problem).toMatch(/^ISSUE-[A-Z]+: \S[^\n]*$/)
    }
  })

  describe('ISSUE-TYPE', () => {
    it('needs a type label', () => {
      const labels = [{ name: 'ci' }, { name: 'priority: low' }]
      expect(ids(groomed({ labels }))).toEqual(['ISSUE-TYPE'])
    })
    it('needs exactly one', () => {
      const labels = [
        { name: 'bug' },
        { name: 'process' },
        { name: 'ci' },
        { name: 'priority: low' },
      ]
      expect(ids(groomed({ labels }))).toEqual(['ISSUE-TYPE'])
    })
  })

  describe('ISSUE-AREA', () => {
    it('needs at least one area', () => {
      const labels = [{ name: 'bug' }, { name: 'priority: low' }]
      expect(ids(groomed({ labels }))).toEqual(['ISSUE-AREA'])
    })
    it('accepts several', () => {
      const labels = [
        { name: 'bug' },
        { name: 'ci' },
        { name: 'tooling' },
        { name: 'priority: low' },
      ]
      expect(ids(groomed({ labels }))).toEqual([])
    })
  })

  describe('ISSUE-PRIORITY', () => {
    it('needs a priority label', () => {
      const labels = [{ name: 'bug' }, { name: 'ci' }]
      expect(ids(groomed({ labels }))).toEqual(['ISSUE-PRIORITY'])
    })
    it('needs exactly one', () => {
      const labels = [
        { name: 'bug' },
        { name: 'ci' },
        { name: 'priority: low' },
        { name: 'priority: high' },
      ]
      expect(ids(groomed({ labels }))).toEqual(['ISSUE-PRIORITY'])
    })
    it('reads labels given as plain strings', () => {
      expect(ids(groomed({ labels: ['bug', 'ci', 'priority: low'] }))).toEqual([])
    })
  })

  describe('ISSUE-SUMMARY', () => {
    it('fails when the summary section is missing', () => {
      const body = GROOMED_BODY.replace(/### Summary\n\n.*\n/, '')
      expect(ids(groomed({ body }))).toEqual(['ISSUE-SUMMARY'])
    })
    it('fails on a heading with no text, the form placeholder or a few words', () => {
      for (const text of ['', '_No response_', 'Too short']) {
        const body = GROOMED_BODY.replace(/(### Summary\n\n).*/, `$1${text}`)
        expect(ids(groomed({ body }))).toEqual(['ISSUE-SUMMARY'])
      }
    })
    it("accepts the issue forms' Problem section and a Goal section", () => {
      for (const name of ['Problem', 'Goal']) {
        const body = GROOMED_BODY.replace('### Summary', `### ${name}`)
        expect(ids(groomed({ body }))).toEqual([])
      }
    })
    it('accepts a heading of any level from two to four', () => {
      for (const marks of ['##', '####']) {
        expect(
          ids(groomed({ body: GROOMED_BODY.replace('### Summary', `${marks} Summary`) })),
        ).toEqual([])
      }
    })
    it('accepts a second-level heading', () => {
      expect(ids(groomed({ body: GROOMED_BODY.replace('### Summary', '## Summary') }))).toEqual([])
    })
    it('does not count a heading hidden in an HTML comment', () => {
      const body = GROOMED_BODY.replace('### Summary', '<!--\n### Summary').replace(
        'is missing.',
        'is missing.\n-->',
      )
      expect(ids(groomed({ body }))).toContain('ISSUE-SUMMARY')
    })
  })

  describe('ISSUE-CRITERIA', () => {
    it('needs the section', () => {
      const body = GROOMED_BODY.replace(/### Acceptance criteria\n\n.*\n/, '')
      expect(ids(groomed({ body }))).toEqual(['ISSUE-CRITERIA'])
    })
    it('needs at least one checkbox', () => {
      const body = GROOMED_BODY.replace('- [ ] ', '- ')
      expect(ids(groomed({ body }))).toEqual(['ISSUE-CRITERIA'])
    })
    it('accepts a ticked box and a star bullet', () => {
      expect(ids(groomed({ body: GROOMED_BODY.replace('- [ ]', '* [x]') }))).toEqual([])
    })
  })

  describe('ISSUE-CRITERIA text', () => {
    it('needs words after the checkbox', () => {
      const body = GROOMED_BODY.replace(
        '- [ ] A new issue missing an item gets one comment.',
        '- [ ]',
      )
      expect(ids(groomed({ body }))).toEqual(['ISSUE-CRITERIA'])
    })
  })

  describe('ISSUE-FILES', () => {
    it('needs both sections', () => {
      for (const heading of ['Files likely touched', 'Must not touch']) {
        const body = GROOMED_BODY.replace(new RegExp(`### ${heading}\\n\\n.*\\n?`), '')
        expect(ids(groomed({ body }))).toEqual(['ISSUE-FILES'])
      }
    })
    it('fails an empty section or the form placeholder', () => {
      for (const text of ['', '_No response_']) {
        const body = GROOMED_BODY.replace('None', text)
        expect(ids(groomed({ body }))).toEqual(['ISSUE-FILES'])
      }
    })
    it('accepts None for either', () => {
      const body = GROOMED_BODY.replace(/`.github[^`]*`/, 'None')
      expect(ids(groomed({ body }))).toEqual([])
    })
  })

  describe('epics', () => {
    it('are exempt from every rule, so a flagged epic is cleared', () => {
      const bare = groomed({ labels: [{ name: 'epic' }], milestone: null, body: null })
      expect(issueProblems(bare, policy)).toEqual([])
    })
    it('lose the label and get the comment marked clear when it was flagged earlier', () => {
      const epic = groomed({ labels: [{ name: 'epic' }, { name: GROOMING_LABEL }] })
      const old = {
        id: 4,
        body: groomingComment(['ISSUE-FILES: Fill in.']),
        user: { type: 'Bot', login: 'github-actions[bot]' },
      }
      expect(
        groomingPlan({ problems: issueProblems(epic, policy), issue: epic, comments: [old] }),
      ).toEqual({
        comment: { action: 'update', id: 4, body: clearComment() },
        label: 'remove',
      })
    })
  })

  describe('ISSUE-MILESTONE', () => {
    it('needs a milestone, any milestone', () => {
      expect(ids(groomed({ milestone: null }))).toEqual(['ISSUE-MILESTONE'])
      expect(ids(groomed({ milestone: { title: 'Anything' } }))).toEqual([])
    })
    it('never asks for an epic or a parent', () => {
      const bare = groomed({ labels: [], milestone: null, body: null })
      expect(issueProblems(bare, policy).join('\n')).not.toMatch(/PARENT|epic/i)
    })
  })
})

describe('skipReason', () => {
  it('checks an open issue filed by a person', () => {
    expect(skipReason(groomed())).toBeNull()
  })
  it('skips pull requests', () => {
    expect(skipReason(groomed({ pull_request: {} }))).toMatch(/pull request/i)
  })
  it('skips issues filed by a bot, Dependabot included', () => {
    expect(skipReason(groomed({ user: { login: 'dependabot[bot]', type: 'Bot' } }))).toMatch(/bot/i)
    expect(skipReason(groomed({ user: { login: 'dependabot[bot]', type: 'User' } }))).toMatch(
      /bot/i,
    )
  })
  it('skips a closed issue', () => {
    expect(skipReason(groomed({ state: 'closed' }))).toMatch(/closed/i)
  })
})

describe('groomingComment', () => {
  const problems = ['ISSUE-TYPE: Add one type label.', 'ISSUE-MILESTONE: Set a milestone.']
  it('starts with the marker and lists each problem once', () => {
    const body = groomingComment(problems)
    expect(body.startsWith(COMMENT_MARKER)).toBe(true)
    for (const problem of problems) expect(body.split(problem)).toHaveLength(2)
    expect(body).toContain(GROOMING_LABEL)
  })
  it('has a cleared form that carries the marker and no rule ID', () => {
    expect(clearComment().startsWith(COMMENT_MARKER)).toBe(true)
    expect(clearComment()).not.toMatch(/ISSUE-[A-Z]/)
  })
})

describe('groomingPlan', () => {
  const failing = ['ISSUE-TYPE: Add one type label.']
  const flagged = groomed({ labels: [{ name: GROOMING_LABEL }] })
  const mine = (body, id = 7) => ({ id, body, user: { type: 'Bot', login: 'github-actions[bot]' } })

  it('creates one comment and the label for a new failing issue', () => {
    expect(
      groomingPlan({ problems: failing, issue: groomed({ labels: [] }), comments: [] }),
    ).toEqual({
      comment: { action: 'create', body: groomingComment(failing) },
      label: 'add',
    })
  })
  it('updates the same comment instead of posting another', () => {
    const next = ['ISSUE-AREA: Add an area.']
    const plan = groomingPlan({
      problems: next,
      issue: flagged,
      comments: [mine(groomingComment(failing))],
    })
    expect(plan).toEqual({
      comment: { action: 'update', id: 7, body: groomingComment(next) },
      label: 'none',
    })
  })
  it('does nothing when nothing changed, so label events cannot loop', () => {
    const plan = groomingPlan({
      problems: failing,
      issue: flagged,
      comments: [mine(groomingComment(failing))],
    })
    expect(plan).toEqual({ comment: { action: 'none' }, label: 'none' })
  })
  it('clears the label and marks the comment clear once everything passes', () => {
    const plan = groomingPlan({
      problems: [],
      issue: flagged,
      comments: [mine(groomingComment(failing))],
    })
    expect(plan).toEqual({
      comment: { action: 'update', id: 7, body: clearComment() },
      label: 'remove',
    })
  })
  it('stays silent for a passing issue that was never flagged', () => {
    expect(groomingPlan({ problems: [], issue: groomed({ labels: [] }), comments: [] })).toEqual({
      comment: { action: 'none' },
      label: 'none',
    })
  })
  it('puts the label back if it was removed by hand while rules still fail', () => {
    const plan = groomingPlan({
      problems: failing,
      issue: groomed({ labels: [] }),
      comments: [mine(groomingComment(failing))],
    })
    expect(plan.label).toBe('add')
  })
  it('ignores a comment from a bot other than Actions', () => {
    const other = {
      id: 9,
      body: groomingComment(failing),
      user: { type: 'Bot', login: 'other[bot]' },
    }
    const plan = groomingPlan({
      problems: failing,
      issue: groomed({ labels: [] }),
      comments: [other],
    })
    expect(plan.comment.action).toBe('create')
  })
  it('ignores a look-alike comment written by a person', () => {
    const faked = {
      id: 9,
      body: groomingComment(failing),
      user: { type: 'User', login: 'someone' },
    }
    expect(
      groomingPlan({ problems: failing, issue: groomed({ labels: [] }), comments: [faked] }).comment
        .action,
    ).toBe('create')
  })
})
