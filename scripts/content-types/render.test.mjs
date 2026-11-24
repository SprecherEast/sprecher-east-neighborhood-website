import { describe, expect, it } from 'vitest'

import {
  GENERATED_NOTICE,
  buildPages,
  cell,
  code,
  renderAccess,
  renderEndpoints,
  renderFieldTable,
  renderHooks,
} from './render.mjs'

const row = (over) => ({
  path: 'title',
  type: 'text',
  required: 'yes',
  detail: '',
  notes: [],
  section: '',
  access: [],
  hooks: [],
  ...over,
})

describe('cell and code', () => {
  it('escapes a backslash and a pipe in plain text, so a backslash can not cancel the pipe escape', () => {
    expect(cell('a\\|b')).toBe('a\\\\\\|b')
  })

  it('leaves a backslash alone inside a code span of a plain-text cell (#1461)', () => {
    expect(cell('matches `^\\d(Z|X)$` and a\\b')).toBe('matches `^\\d(Z\\|X)$` and a\\\\b')
  })

  it('escapes only the pipe in a code span, where a backslash is no escape (#1461)', () => {
    expect(code('^\\d{4}(Z|[+-]\\d{2})$')).toBe('`^\\d{4}(Z\\|[+-]\\d{2})$`')
    expect(code('')).toBe('')
    expect(code('a\nb')).toBe('`a b`')
  })
})

describe('renderFieldTable', () => {
  it('writes one table row per field, with notes and field access joined', () => {
    const table = renderFieldTable([
      row({ notes: ['hidden', 'indexed'], access: ['read: admin'] }),
      row({ path: 'a|b', type: 'select', required: 'no', detail: 'x, y' }),
    ])
    expect(table.split('\n')).toEqual([
      '| Field | Type | Required | Target or options | Notes |',
      '| --- | --- | --- | --- | --- |',
      '| `title` | text | yes |  | hidden; indexed; access read: admin |',
      '| `a\\|b` | select | no | x, y |  |',
    ])
  })

  it('escapes a backslash before a pipe in plain text, and only the pipe in a code span', () => {
    const [, , body] = renderFieldTable([row({ detail: 'a\\|b', path: 'c\\|d' })]).split('\n')
    expect(body).toBe('| `c\\\\|d` | text | yes | a\\\\\\|b |  |')
  })
})

describe('renderAccess', () => {
  it('writes a table of operation, function and where it lives', () => {
    expect(
      renderAccess([{ operation: 'read', name: 'anyone', file: 'src/platform/payload/roles.ts' }]),
    ).toBe(
      [
        '| Operation | Function | Defined in |',
        '| --- | --- | --- |',
        '| read | `anyone` | `src/platform/payload/roles.ts` |',
      ].join('\n'),
    )
  })

  it('adds what an inline function does when it only allows or denies', () => {
    expect(
      renderAccess([{ operation: 'read', name: 'inline', note: 'always allows', file: 'payload' }]),
    ).toContain('| read | inline (always allows) | payload |')
  })

  it('says the Payload default applies when nothing is set', () => {
    expect(renderAccess([])).toContain('default applies')
  })
})

describe('renderEndpoints', () => {
  it('writes nothing when there are none', () => {
    expect(renderEndpoints([])).toBe('')
  })

  it('writes method, path, handler and file', () => {
    const endpoint = { method: 'POST', path: '/verify/:token', name: 'inline', file: 'src/a.ts' }
    expect(renderEndpoints([endpoint])).toContain(
      '| POST | `/verify/:token` | inline | `src/a.ts` |',
    )
  })
})

describe('renderHooks', () => {
  it('writes nothing for a type with no hooks', () => {
    expect(renderHooks([])).toBe('None.')
  })

  it('writes phase, function and file', () => {
    expect(renderHooks([{ phase: 'beforeChange', name: 'hold', file: 'src/a.ts' }])).toContain(
      '| beforeChange | `hold` | `src/a.ts` |',
    )
  })
})

const model = (over) => ({
  slug: 'events',
  kind: 'collection',
  title: 'Events',
  purpose: 'Neighborhood events',
  versions: ['Drafts: no', 'Versions: none kept'],
  access: [],
  hooks: [],
  endpoints: [],
  fields: [row()],
  auth: [],
  upload: [],
  ...over,
})

describe('buildPages', () => {
  it('starts every page with the generated notice, then the title', () => {
    const pages = buildPages([model()])
    const events = pages.get('events.md')
    expect(events.split('\n')[0]).toBe(GENERATED_NOTICE)
    expect(events).toContain('# Events (`events`)')
  })

  it('shows a type’s custom endpoints under its hooks, and none when it has none', () => {
    const endpoint = { method: 'POST', path: '/verify/:token', name: 'inline', file: 'src/a.ts' }
    const pages = buildPages([model({ endpoints: [endpoint] }), model({ slug: 'faq' })])
    expect(pages.get('events.md')).toContain('## Custom endpoints')
    expect(pages.get('faq.md')).not.toContain('Custom endpoints')
  })

  it('names the owner, with the file that defines the type, when it is known (#1461)', () => {
    const owner = { owner: 'module `events`', file: 'src/modules/events/cms/events.ts' }
    const page = buildPages([model({ owner })]).get('events.md')
    expect(page).toContain(
      '- Owner: module `events`, defined in `src/modules/events/cms/events.ts`',
    )
    expect(
      buildPages([model({ owner: { owner: 'a plugin or Payload', file: '' } })]).get('events.md'),
    ).toContain('- Owner: a plugin or Payload')
    expect(buildPages([model()]).get('events.md')).not.toContain('Owner')
  })

  it('links the AI agent tools and the jobs that reach the type (#1461)', () => {
    const page = buildPages([model({ tools: ['findEvents'], jobs: ['deleteOld'] })]).get(
      'events.md',
    )
    const lines = page.split('\n')
    expect(lines).toContain('- AI agent tools: `findEvents` ([list](../mcp-tools.md))')
    expect(lines).toContain('- Jobs: `deleteOld` ([list](../jobs.md))')
    expect(buildPages([model()]).get('events.md')).not.toContain('AI agent tools')
    // the loader gives every type a list, empty when no tool or job reaches it
    const none = buildPages([model({ tools: [], jobs: [] })]).get('events.md')
    expect(none).not.toContain('AI agent tools')
    expect(none).not.toContain('- Jobs:')
  })

  it('says in the README that the pages are generated for production', () => {
    expect(buildPages([model()]).get('README.md')).toContain('NODE_ENV=production')
  })

  it('lists every page in the README, one line each', () => {
    const pages = buildPages([model(), model({ slug: 'faq', title: 'FAQ' })])
    const readme = pages.get('README.md')
    expect(readme).toContain('[`events`](events.md)')
    expect(readme).toContain('[`faq`](faq.md)')
  })

  it('is the same on every run and sorts the pages by slug', () => {
    const models = [model({ slug: 'b' }), model({ slug: 'a' })]
    const first = buildPages(models)
    const second = buildPages([...models].reverse())
    expect([...first]).toEqual([...second])
    expect(first.get('README.md').indexOf('(a.md)')).toBeLessThan(
      first.get('README.md').indexOf('(b.md)'),
    )
  })

  it('splits a page over the line limit into one page per section, linked from the main page', () => {
    const rows = [
      row({ path: 'title' }),
      ...Array.from({ length: 15 }, (_, i) => row({ path: `hero.f${i}`, section: 'Hero' })),
      ...Array.from({ length: 15 }, (_, i) => row({ path: `seo.f${i}`, section: 'SEO tab' })),
    ]
    const pages = buildPages([model({ fields: rows })], { limit: 40 })
    expect([...pages.keys()].sort()).toEqual([
      'README.md',
      'events--hero.md',
      'events--seo-tab.md',
      'events.md',
    ])
    const main = pages.get('events.md')
    expect(main).toContain('[Hero](events--hero.md)')
    expect(main).toContain('`title`')
    expect(main).not.toContain('hero.f0')
    expect(pages.get('events--hero.md')).toContain('`hero.f0`')
    expect(pages.get('events--hero.md').split('\n')[0]).toBe(GENERATED_NOTICE)
  })

  it('keeps a page whole when it is within the limit', () => {
    const rows = [row(), row({ path: 'hero.type', section: 'Hero' })]
    const pages = buildPages([model({ fields: rows })])
    expect([...pages.keys()].sort()).toEqual(['README.md', 'events.md'])
    expect(pages.get('events.md')).toContain('`hero.type`')
  })

  it('fails when a section is still over the limit, so the split is never silent', () => {
    const rows = Array.from({ length: 60 }, (_, i) => row({ path: `hero.f${i}`, section: 'Hero' }))
    expect(() => buildPages([model({ fields: rows })], { limit: 40 })).toThrow(
      /events--hero\.md.*lines/,
    )
  })

  it('writes a whole page and the README, kept as text to read when it changes (#1461)', async () => {
    const owner = { owner: 'module `events`', file: 'src/modules/events/cms/events.ts' }
    const pages = buildPages([
      model({ owner, tools: ['findEvents', 'createEvents'], jobs: ['deleteOld', 'sendDigest'] }),
    ])
    await expect(pages.get('events.md')).toMatchFileSnapshot('./__snapshots__/events-page.txt')
    await expect(pages.get('README.md')).toMatchFileSnapshot('./__snapshots__/readme-page.txt')
  })
})
