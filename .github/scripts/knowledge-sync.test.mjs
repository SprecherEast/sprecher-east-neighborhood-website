import { describe, expect, it } from 'vitest'

import { declaredBehavior, knowledgeProblems } from './knowledge-sync.mjs'

const EVENTS_NOTE = 'src/modules/events/README.md'
const NEWS_NOTE = 'src/modules/news/README.md'
const CARD = 'src/modules/events/ui/EventCard.tsx'
const mapJson = JSON.stringify([{ note: EVENTS_NOTE, paths: ['src/modules/events/**'] }])
const bodyWith = (line) => `Closes #1\n\n## Knowledge\n\n${line}\n\n## Why\nx`

const check = ({ changedFiles, body = '', notes = [EVENTS_NOTE], map = mapJson }) =>
  knowledgeProblems({
    mapJson: map,
    changedFiles,
    noteExists: (note) => notes.includes(note),
    body,
  })

describe('declaredBehavior', () => {
  it('reads "none" and its reason from the Knowledge section', () => {
    const body = bodyWith('Behavior change: none, only the order of two imports')
    expect(declaredBehavior(body)).toEqual({
      change: 'none',
      reason: 'only the order of two imports',
    })
  })

  it.each([
    ['dash', 'Behavior change: none - a refactor that keeps behavior'],
    ['em dash', 'Behavior change: none — a refactor that keeps behavior'],
    ['bold', '**Behavior change:** none: a refactor that keeps behavior'],
    ['list item', '- Behavior change: None. A refactor that keeps behavior'],
    ['lower case', 'behavior change: none a refactor that keeps behavior'],
  ])('accepts the %s form', (_name, line) => {
    const declared = declaredBehavior(bodyWith(line))
    expect(declared.change).toBe('none')
    expect(declared.reason.toLowerCase()).toBe('a refactor that keeps behavior')
  })

  it('reads "yes" and what changed', () => {
    const body = bodyWith('Behavior change: yes, the card shows the end time')
    expect(declaredBehavior(body)).toEqual({ change: 'yes', reason: 'the card shows the end time' })
  })

  it('joins a reason that continues on the next line', () => {
    const body = bodyWith('Behavior change: none\nonly renames a private helper in the module')
    expect(declaredBehavior(body).reason).toBe('only renames a private helper in the module')
  })

  it('finds nothing when the line is blank, missing, or only in a comment', () => {
    expect(declaredBehavior(bodyWith('Behavior change:'))).toBeNull()
    expect(declaredBehavior('Closes #1')).toBeNull()
    expect(
      declaredBehavior(bodyWith('<!-- Behavior change: none, a long enough reason -->')),
    ).toBeNull()
  })

  it('ignores the line outside the Knowledge section', () => {
    expect(
      declaredBehavior('## Why\nBehavior change: none because of a long reason here'),
    ).toBeNull()
  })
})

describe('knowledgeProblems', () => {
  it('fails a code change with no note change and no declaration, naming the note', () => {
    const problems = check({ changedFiles: [CARD] })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(EVENTS_NOTE)
    expect(problems[0]).toContain(CARD)
  })

  it('passes once the note changes', () => {
    expect(check({ changedFiles: [CARD, EVENTS_NOTE] })).toEqual([])
  })

  it('passes with "Behavior change: none" and a reason', () => {
    const body = bodyWith('Behavior change: none, renames a local variable and nothing visible')
    expect(check({ changedFiles: [CARD], body })).toEqual([])
  })

  it('fails a "none" with a reason under 20 characters', () => {
    const body = bodyWith('Behavior change: none, a refactor')
    const problems = check({ changedFiles: [CARD], body })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('20')
  })

  it('fails "Behavior change: yes" without the note', () => {
    const body = bodyWith('Behavior change: yes, the card shows the end time')
    const problems = check({ changedFiles: [CARD], body })
    expect(problems[0]).toContain(EVENTS_NOTE)
    expect(problems[0]).toContain('yes')
  })

  it('passes "yes" with the note', () => {
    const body = bodyWith('Behavior change: yes, the card shows the end time')
    expect(check({ changedFiles: [CARD, EVENTS_NOTE], body })).toEqual([])
  })

  it('asks for nothing when only tests change', () => {
    const files = [
      'src/modules/events/ui/EventCard.test.tsx',
      'src/modules/events/domain/x.test.ts',
    ]
    expect(check({ changedFiles: files })).toEqual([])
  })

  it('asks for nothing when the change is only the note', () => {
    expect(check({ changedFiles: [EVENTS_NOTE] })).toEqual([])
  })

  it('asks for nothing when no file is under any entry', () => {
    expect(check({ changedFiles: [`${NEWS_NOTE}x`, 'docs/project.md'] })).toEqual([])
  })

  it('asks for nothing when the note does not exist yet', () => {
    expect(check({ changedFiles: [CARD], notes: [] })).toEqual([])
  })

  it('names each missing note once, however many files changed under it', () => {
    const map = JSON.stringify([
      { note: EVENTS_NOTE, paths: ['src/modules/events/**'] },
      { note: NEWS_NOTE, paths: ['src/modules/news/**'] },
    ])
    const problems = check({
      changedFiles: [CARD, 'src/modules/events/domain/a.ts', 'src/modules/news/ui/N.tsx'],
      notes: [EVENTS_NOTE, NEWS_NOTE],
      map,
    })
    expect(problems).toHaveLength(2)
    expect(problems[0]).toContain(EVENTS_NOTE)
    expect(problems[1]).toContain(NEWS_NOTE)
  })

  it('throws on a map it cannot read', () => {
    expect(() => check({ changedFiles: [CARD], map: '{}' })).toThrow(/list/)
  })
})
