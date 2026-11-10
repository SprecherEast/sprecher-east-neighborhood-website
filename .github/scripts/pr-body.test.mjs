import { describe, expect, it } from 'vitest'

import {
  closeProblems,
  descriptionProblems,
  issueProblems,
  linkedIssues,
  ruleMessage,
  sectionsOf,
  timelineShowsPr,
  withoutComments,
} from './pr-body.mjs'

describe('withoutComments', () => {
  it('removes HTML comments, also across lines', () => {
    expect(withoutComments('a<!-- x\ny -->b')).toBe('ab')
  })

  it('leaves no comment marker behind when removal joins two halves of one', () => {
    expect(withoutComments('<!<!-- x -->-- Behavior change: none -->')).toBe('')
    expect(withoutComments('<!-<!-- a -->- b -->ok')).toBe('ok')
  })

  it('drops everything after a comment that is never closed', () => {
    expect(withoutComments('keep\n<!-- Behavior change: none and a long reason')).toBe('keep\n')
  })

  it('reads a CRLF body like an LF one', () => {
    expect(withoutComments('a\r\n<!-- x\r\ny -->b')).toBe('a\nb')
    expect(sectionsOf('## Why\r\nBecause\r\n').why).toBe('Because\n')
  })

  it('treats a missing body as empty', () => {
    expect(withoutComments(null)).toBe('')
  })
})

describe('sectionsOf', () => {
  it('maps each lower-cased heading to its text', () => {
    const sections = sectionsOf('Closes #1\n\n## What changed\nA\n\n## Risk & rollback\nB\n')
    expect(sections['what changed'].trim()).toBe('A')
    expect(sections['risk & rollback'].trim()).toBe('B')
  })

  it('gives an empty section for a heading with no text', () => {
    expect(sectionsOf('## Why')).toEqual({ why: '' })
  })

  it('ignores text before the first heading', () => {
    expect(sectionsOf('Closes #1')).toEqual({})
  })
})

describe('linkedIssues', () => {
  it('reads Closes, Fixes and Resolves forms as closing', () => {
    const body = 'Closes #1\nfixes: #2\nResolved #3'
    expect(linkedIssues(body).closes).toEqual([1, 2, 3])
  })

  it('reads "Part of" as progress, unless the same issue is also closed', () => {
    expect(linkedIssues('Part of #4\nCloses #5\nPart of #5')).toEqual({ closes: [5], partOf: [4] })
  })

  it('lists each issue once and ignores links inside comments', () => {
    expect(linkedIssues('Closes #1 Closes #1 <!-- Closes #9 -->').closes).toEqual([1])
  })

  it('finds nothing in a body with no link', () => {
    expect(linkedIssues(undefined)).toEqual({ closes: [], partOf: [] })
  })
})

const policy = { types: ['bug', 'enhancement', 'process'], areas: ['ci', 'frontend'] }
const goodIssue = {
  labels: [{ name: 'process' }, { name: 'ci' }, { name: 'priority: high' }],
  assignees: [{ login: 'someone' }],
  milestone: { title: 'Backlog' },
}

describe('ruleMessage', () => {
  it('starts every message with its stable ID', () => {
    expect(ruleMessage('PR-CLOSES', 'Add "Closes #N".')).toBe('PR-CLOSES: Add "Closes #N".')
  })
})

describe('closeProblems', () => {
  it('passes one closing link', () => {
    expect(closeProblems({ closes: [7], partOf: [] })).toEqual([])
  })

  it('fails PR-CLOSES with no link at all', () => {
    expect(closeProblems({ closes: [], partOf: [] })).toEqual([
      expect.stringMatching(/^PR-CLOSES: /),
    ])
  })

  it('fails PR-CLOSES for "Part of", even next to a closing link', () => {
    expect(closeProblems({ closes: [], partOf: [7] })[0]).toMatch(/^PR-CLOSES: .*Part of/)
    expect(closeProblems({ closes: [8], partOf: [7] })[0]).toMatch(/^PR-CLOSES: .*Part of/)
  })

  it('fails PR-CLOSES when a PR closes more than one issue', () => {
    expect(closeProblems({ closes: [7, 8], partOf: [] })[0]).toMatch(/^PR-CLOSES: .*exactly one/)
  })
})

describe('issueProblems', () => {
  const labels = (names) => ({ ...goodIssue, labels: names.map((name) => ({ name })) })

  it('passes an issue with labels, an assignee and a milestone, and needs no epic', () => {
    expect(issueProblems(7, goodIssue, policy)).toEqual([])
  })

  it('fails PR-ASSIGNED without an assignee', () => {
    expect(issueProblems(7, { ...goodIssue, assignees: [] }, policy)).toEqual([
      expect.stringMatching(/^PR-ASSIGNED: .*#7/),
    ])
  })

  it('fails PR-MILESTONE without a milestone', () => {
    expect(issueProblems(7, { ...goodIssue, milestone: null }, policy)).toEqual([
      expect.stringMatching(/^PR-MILESTONE: .*#7/),
    ])
  })

  it('fails PR-LABELS for a missing or doubled type, area or priority', () => {
    expect(issueProblems(7, labels(['ci', 'priority: low']), policy)).toEqual([
      expect.stringMatching(/^PR-LABELS: .*type/),
    ])
    expect(issueProblems(7, labels(['bug', 'process', 'ci', 'priority: low']), policy)).toEqual([
      expect.stringMatching(/^PR-LABELS: .*type/),
    ])
    expect(issueProblems(7, labels(['bug', 'priority: low']), policy)).toEqual([
      expect.stringMatching(/^PR-LABELS: .*area/),
    ])
    expect(issueProblems(7, labels(['bug', 'ci']), policy)).toEqual([
      expect.stringMatching(/^PR-LABELS: .*priority/),
    ])
  })

  it('accepts labels given as plain strings', () => {
    expect(
      issueProblems(7, { ...goodIssue, labels: ['bug', 'ci', 'priority: low'] }, policy),
    ).toEqual([])
  })

  it('reports every broken rule, each with its own ID', () => {
    const broken = { labels: [], assignees: [], milestone: null }
    const ids = issueProblems(7, broken, policy).map((message) => message.split(':')[0])
    expect(ids).toEqual(['PR-LABELS', 'PR-LABELS', 'PR-LABELS', 'PR-ASSIGNED', 'PR-MILESTONE'])
  })
})

describe('timelineShowsPr', () => {
  const crossReference = (number, isPr = true) => ({
    event: 'cross-referenced',
    source: { issue: { number, ...(isPr ? { pull_request: {} } : {}) } },
  })

  it('finds the PR as a cross-reference on the issue timeline', () => {
    expect(timelineShowsPr([{ event: 'labeled' }, crossReference(12)], 12)).toBe(true)
  })

  it('finds the PR as a connected event', () => {
    expect(timelineShowsPr([{ event: 'connected', source: { issue: { number: 12 } } }], 12)).toBe(
      true,
    )
  })

  it('does not count another PR, or an issue that has the same number', () => {
    expect(timelineShowsPr([crossReference(13)], 12)).toBe(false)
    expect(timelineShowsPr([crossReference(12, false)], 12)).toBe(false)
    expect(timelineShowsPr([], 12)).toBe(false)
  })
})

describe('descriptionProblems', () => {
  const filled = [
    'Closes #1',
    ...['What changed', 'Why', 'How', 'How to test', 'Risk & rollback'].map(
      (name) => `## ${name}\nSomething long enough`,
    ),
    '## Self-review',
    ...['Reuse', 'Quality', 'Efficiency', 'Guidelines', 'Visual'].map(
      (item) => `- ${item}: checked and fixed it`,
    ),
  ].join('\n')

  it('passes a filled-in description', () => {
    expect(descriptionProblems(filled)).toEqual([])
  })

  it('fails PR-SECTIONS for an empty section; a numbered placeholder counts as empty', () => {
    const body = filled.replace('## Why\nSomething long enough', '## Why\n1.\n')
    expect(descriptionProblems(body)).toEqual([expect.stringMatching(/^PR-SECTIONS: .*"## Why"/)])
  })

  it('fails PR-SELF-REVIEW for an item with no answer', () => {
    const body = filled.replace('- Visual: checked and fixed it', '- Visual:')
    expect(descriptionProblems(body)).toEqual([expect.stringMatching(/^PR-SELF-REVIEW: .*Visual/)])
  })
})
