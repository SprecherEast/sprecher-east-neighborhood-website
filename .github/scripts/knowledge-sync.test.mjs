import { describe, expect, it } from 'vitest'

import {
  LIST_FILES_LIMIT,
  changedFiles,
  declaredBehavior,
  knowledgeProblems,
} from './knowledge-sync.mjs'

const EVENTS_NOTE = 'src/modules/events/README.md'
const NEWS_NOTE = 'src/modules/news/README.md'
const CARD = 'src/modules/events/ui/EventCard.tsx'
const mapJson = JSON.stringify([{ note: EVENTS_NOTE, paths: ['src/modules/events/**'] }])
const bodyWith = (line) => `Closes #1\n\n## Knowledge\n\n${line}\n\n## Why\nx`

/** A changed file the way GitHub lists it; a string is code with a real change in it */
const file = (entry) =>
  typeof entry === 'string'
    ? { filename: entry, status: 'modified', patch: '@@ -1 +1 @@\n-const a = 1\n+const a = 2' }
    : entry

const check = ({ changed, body = '', notes = [EVENTS_NOTE], map = mapJson }) =>
  knowledgeProblems({
    mapJson: map,
    files: changed.map(file),
    noteExists: (note) => notes.includes(note),
    body,
  })

const NONE = bodyWith('Behavior change: none, renames a local variable and nothing visible')
const COMMENT_PATCH = '@@ -1 +1 @@\n-// old\n+// new'

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

  it('reads a declaration in a CRLF body', () => {
    const body =
      '## Knowledge\r\n\r\nBehavior change: none, only renames a local variable\r\n\r\n## Why\r\nx'
    expect(declaredBehavior(body)).toEqual({
      change: 'none',
      reason: 'only renames a local variable',
    })
  })

  it.each([
    ['spaces', 'Behavior change' + ' '.repeat(10_000)],
    ['spaces before the answer', 'Behavior change:' + ' '.repeat(10_000) + 'maybe'],
    ['asterisks', 'Behavior change' + '*'.repeat(10_000) + 'x'],
    ['mixed', 'Behavior change' + ' *'.repeat(5_000) + 'x'],
  ])('reads a 10,000-character line of %s quickly', (_name, line) => {
    const started = Date.now()
    expect(declaredBehavior(bodyWith(line))).toBeNull()
    expect(Date.now() - started).toBeLessThan(500)
  })

  it('ignores the line outside the Knowledge section', () => {
    expect(
      declaredBehavior('## Why\nBehavior change: none because of a long reason here'),
    ).toBeNull()
  })
})

describe('knowledgeProblems: mapped notes', () => {
  it('fails a code change with no note change and no declaration, naming the note', () => {
    const problems = check({ changed: [CARD] })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(EVENTS_NOTE)
    expect(problems[0]).toContain(CARD)
  })

  it('still wants the mapped note when another doc changed', () => {
    const problems = check({ changed: [CARD, 'docs/guidelines/payload-cms.md'] })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(EVENTS_NOTE)
  })

  it('passes once the note changes', () => {
    expect(check({ changed: [CARD, EVENTS_NOTE] })).toEqual([])
  })

  it('passes with "Behavior change: none" and a reason', () => {
    expect(check({ changed: [CARD], body: NONE })).toEqual([])
  })

  it('fails a "none" with a reason under 20 characters', () => {
    const body = bodyWith('Behavior change: none, a refactor')
    const problems = check({ changed: [CARD], body })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('20')
  })

  it('fails "Behavior change: yes" without the note', () => {
    const body = bodyWith('Behavior change: yes, the card shows the end time')
    const problems = check({ changed: [CARD], body })
    expect(problems[0]).toContain(EVENTS_NOTE)
    expect(problems[0]).toContain('yes')
  })

  it('passes "yes" with the note', () => {
    const body = bodyWith('Behavior change: yes, the card shows the end time')
    expect(check({ changed: [CARD, EVENTS_NOTE], body })).toEqual([])
  })

  it('asks for nothing when only tests change', () => {
    const changed = [
      'src/modules/events/ui/EventCard.test.tsx',
      'src/modules/events/domain/x.test.ts',
    ]
    expect(check({ changed })).toEqual([])
  })

  it('asks for nothing when a mapped file changes only in a comment', () => {
    const comment = { filename: CARD, status: 'modified', patch: COMMENT_PATCH }
    expect(check({ changed: [comment] })).toEqual([])
  })

  it('asks for nothing when the change is only the note', () => {
    expect(check({ changed: [EVENTS_NOTE] })).toEqual([])
  })

  it('asks for nothing when the note does not exist yet, but the general rule still applies', () => {
    expect(check({ changed: [CARD], notes: [] })).toHaveLength(1)
    expect(check({ changed: [CARD, 'docs/project.md'], notes: [] })).toEqual([])
  })

  it('names each missing note once, however many files changed under it', () => {
    const map = JSON.stringify([
      { note: EVENTS_NOTE, paths: ['src/modules/events/**'] },
      { note: NEWS_NOTE, paths: ['src/modules/news/**'] },
    ])
    const problems = check({
      changed: [CARD, 'src/modules/events/domain/a.ts', 'src/modules/news/ui/N.tsx'],
      notes: [EVENTS_NOTE, NEWS_NOTE],
      map,
    })
    expect(problems).toHaveLength(2)
    expect(problems[0]).toContain(EVENTS_NOTE)
    expect(problems[1]).toContain(NEWS_NOTE)
  })

  it('throws on a map it cannot read', () => {
    expect(() => check({ changed: [CARD], map: '{}' })).toThrow(/list/)
  })

  it('makes a move out of a mapped folder ask for the note', () => {
    const moved = {
      filename: 'src/platform/ui/EventCard.tsx',
      previous_filename: CARD,
      status: 'renamed',
    }
    const problems = check({ changed: [moved] })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(EVENTS_NOTE)
  })
})

describe('knowledgeProblems: the whole repository (#770)', () => {
  const BLOCK = 'src/modules/site/ui/MapBlock.tsx'
  const PLATFORM = 'src/platform/ui/Link.tsx'
  const GUIDELINE = 'docs/guidelines/payload-cms.md'

  it('fails behavior-bearing code outside any mapped module', () => {
    const problems = check({ changed: ['scripts/deploy.mjs'] })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('scripts/deploy.mjs')
    expect(problems[0]).toContain('Behavior change: none')
  })

  it.each([
    ['a workflow', '.github/workflows/ci.yml'],
    ['a server script', 'ops/deploy.sh'],
    ['a route', 'src/app/(frontend)/page.tsx'],
    ['config', 'next.config.ts'],
  ])('fails %s', (_name, path) => {
    expect(check({ changed: [path] })).toHaveLength(1)
  })

  it('passes when any doc changes with it', () => {
    expect(check({ changed: ['scripts/deploy.mjs', GUIDELINE] })).toEqual([])
    expect(check({ changed: ['ops/deploy.sh', 'ops/README.md'] })).toEqual([])
  })

  it('passes with a declared "none" and a reason of 20 characters', () => {
    expect(check({ changed: ['scripts/deploy.mjs'], body: NONE })).toEqual([])
  })

  it('fails "none" with a short reason and "yes" without a doc', () => {
    const short = check({
      changed: ['scripts/deploy.mjs'],
      body: bodyWith('Behavior change: none, x'),
    })
    expect(short[0]).toContain('20')
    const yes = check({
      changed: ['scripts/deploy.mjs'],
      body: bodyWith('Behavior change: yes, deploys faster'),
    })
    expect(yes[0]).toContain('yes')
  })

  it.each([
    ['tests', ['src/platform/ui/Link.test.tsx', 'e2e/home.spec.ts']],
    ['docs', ['docs/guidelines/payload-cms.md', 'README.md']],
    ['a lockfile', ['package-lock.json']],
    ['the generated types', ['src/payload-types.ts']],
  ])('asks for nothing when only %s change', (_name, changed) => {
    expect(check({ changed })).toEqual([])
  })

  it('asks for nothing when code changes only in comments or formatting', () => {
    const comment = { filename: PLATFORM, status: 'modified', patch: COMMENT_PATCH }
    const format = {
      filename: 'scripts/a.mjs',
      status: 'modified',
      patch: '@@ -1 +1 @@\n-const a = \'x\';\n+const a = "x"',
    }
    expect(check({ changed: [comment, format] })).toEqual([])
  })

  it('asks for nothing for a patch-level dependency bump with its lockfile', () => {
    const pkg = {
      filename: 'package.json',
      status: 'modified',
      patch: '@@ -1 +1 @@\n-    "zod": "^3.22.1",\n+    "zod": "^3.22.4",',
    }
    expect(check({ changed: [pkg, 'package-lock.json'] })).toEqual([])
  })

  it('asks for the declaration when the diff is missing', () => {
    const big = { filename: 'src/big.ts', status: 'modified' }
    expect(check({ changed: [big] })).toHaveLength(1)
  })

  it('reports a PR that changes code and tests next to a comment once, listing the code', () => {
    const problems = check({
      changed: [
        'scripts/deploy.mjs',
        'scripts/deploy.test.mjs',
        { filename: PLATFORM, status: 'modified', patch: COMMENT_PATCH },
      ],
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('scripts/deploy.mjs')
    expect(problems[0]).not.toContain('Link.tsx')
  })

  it('replays PR #766: map block code under site and platform, payload-cms.md not changed', () => {
    const body = bodyWith(
      'Behavior change: yes, a new map block. Updated the block list in docs/guidelines/payload-cms.md',
    )
    const problems = check({
      changed: [
        BLOCK,
        'src/modules/site/cms/blocks/mapBlock.ts',
        PLATFORM,
        'src/platform/ui/MapEmbed.tsx',
        'src/modules/site/ui/MapBlock.test.tsx',
        'src/payload-types.ts',
      ],
      body,
    })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(BLOCK)
    expect(problems[0]).toContain('yes')
  })

  it('passes the #766 replay once the guideline is in the diff', () => {
    expect(check({ changed: [BLOCK, PLATFORM, GUIDELINE] })).toEqual([])
  })

  it('shortens a long list of files', () => {
    const many = Array.from({ length: 6 }, (_, i) => `scripts/s${i}.mjs`)
    const problems = check({ changed: many })
    expect(problems[0]).toContain('and 3 more')
  })
})

describe('changedFiles', () => {
  it('returns the files as given', () => {
    const files = [{ filename: 'docs/project.md' }]
    expect(changedFiles(files)).toEqual(files)
  })

  it('refuses a list GitHub may have cut short', () => {
    const files = Array.from({ length: LIST_FILES_LIMIT }, (_, i) => ({ filename: `f${i}` }))
    expect(() => changedFiles(files)).toThrow(new RegExp(String(LIST_FILES_LIMIT)))
    expect(() => changedFiles(files.slice(1))).not.toThrow()
  })
})
