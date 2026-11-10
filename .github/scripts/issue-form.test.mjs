import { describe, expect, it } from 'vitest'

import { NO_RESPONSE, formAnswers, formChoices } from './issue-form.mjs'

const policy = {
  types: ['bug', 'enhancement', 'process'],
  areas: ['ci', 'frontend', 'tooling'],
  priorities: { high: 'b60205', medium: 'fbca04', low: '0e8a16' },
}

const form = (type, area, priority) =>
  `### Type\n\n${type}\n\n### Problem\n\nSomething.\n\n### Area\n\n${area}\n\n### Priority\n\n${priority}\n`

describe('formAnswers', () => {
  it('lists every heading occurrence in order, trimmed, titles lower-cased', () => {
    expect(formAnswers('### Type\n\n process \n\n### Type\n\nbug\n')).toEqual([
      { title: 'type', text: 'process' },
      { title: 'type', text: 'bug' },
    ])
  })

  it("reads the form's empty answer as empty text", () => {
    expect(formAnswers(`### Area\n\n${NO_RESPONSE}\n`)).toEqual([{ title: 'area', text: '' }])
  })

  it('reads third-level headings by default and a wider range when asked', () => {
    const body = '## Two\na\n### Three\nb\n'
    expect(formAnswers(body).map((a) => a.title)).toEqual(['three'])
    expect(formAnswers(body, { minLevel: 2, maxLevel: 4 }).map((a) => a.title)).toEqual([
      'two',
      'three',
    ])
  })

  it('ignores a heading hidden in an HTML comment', () => {
    expect(formAnswers('### Type\n\nbug\n<!--\n### Priority\n\nhigh\n-->\n')).toEqual([
      { title: 'type', text: 'bug' },
    ])
  })

  it('reads a missing body as no answers', () => {
    expect(formAnswers(null)).toEqual([])
  })
})

describe('formChoices', () => {
  it('reads the type, the areas and the priority of a form', () => {
    expect(formChoices(form('process', 'ci, tooling', 'high'), policy)).toEqual({
      type: 'process',
      areas: ['ci', 'tooling'],
      priority: 'high',
    })
  })

  it('reads values in any case', () => {
    expect(formChoices(form('Bug', 'CI', 'Low'), policy)).toEqual({
      type: 'bug',
      areas: ['ci'],
      priority: 'low',
    })
  })

  it('finds nothing in an answer that is empty or not an option', () => {
    expect(formChoices(form(NO_RESPONSE, 'ci, nonsense', 'urgent'), policy)).toEqual({
      type: undefined,
      areas: [],
      priority: undefined,
    })
  })

  it('takes the first valid Type and the last valid Area and Priority, so typed headings cannot spoof them', () => {
    // A free-text answer can hold a heading with a valid value: it comes before the real dropdown
    const body =
      '### Type\n\nbug\n\n### Problem\n\nx\n\n### Type\n\nprocess\n\n### Area\n\nci\n\n' +
      '### Priority\n\nhigh\n\n### Area\n\nfrontend\n\n### Priority\n\nlow\n\n' +
      '### Priority\n\nnot-a-priority\n'
    expect(formChoices(body, policy)).toEqual({
      type: 'bug',
      areas: ['frontend'],
      priority: 'low',
    })
  })

  it('does not let an empty answer count as valid, so it cannot replace an earlier valid one', () => {
    const body = `### Priority\n\nlow\n\n### Priority\n\n${NO_RESPONSE}\n\n### Area\n\nci\n\n### Area\n\n`
    expect(formChoices(body, policy)).toEqual({ type: undefined, areas: ['ci'], priority: 'low' })
  })

  it('starts a section only at a third-level heading, so a deeper one in an answer is text', () => {
    const body = '### Priority\n\nlow\n\n#### Priority\n\nhigh\n'
    expect(formAnswers(body)).toEqual([{ title: 'priority', text: 'low\n\n#### Priority\n\nhigh' }])
    // the deeper line is part of the one answer, which is then not a valid option
    expect(formChoices(body, policy).priority).toBeUndefined()
  })

  it('ignores blank entries in a list of values', () => {
    expect(formChoices(form('bug', 'ci, ,tooling,', 'low'), policy).areas).toEqual([
      'ci',
      'tooling',
    ])
  })

  it('does not count a heading hidden in a comment (a hidden spoof used to count)', () => {
    const body = form('bug', 'ci', 'low') + '<!--\n### Priority\n\nhigh\n-->\n'
    expect(formChoices(body, policy).priority).toBe('low')
  })

  it('finds nothing in a body without a form', () => {
    expect(formChoices('Just text', policy)).toEqual({
      type: undefined,
      areas: [],
      priority: undefined,
    })
  })
})
