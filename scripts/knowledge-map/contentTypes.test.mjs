import { describe, expect, it } from 'vitest'

import { buildContentTypes } from './contentTypes.mjs'

const row = (path, type, over = {}) => ({
  path,
  type,
  required: 'no',
  detail: '',
  link: null,
  unique: false,
  indexed: false,
  notes: [],
  section: '',
  access: [],
  hooks: [],
  ...over,
})

const model = (slug, over = {}) => ({
  slug,
  kind: 'collection',
  title: slug,
  purpose: '',
  versions: [],
  access: [{ operation: 'read', name: 'anyone', note: '', file: 'src/platform/payload/anyone.ts' }],
  hooks: [],
  graphQL: true,
  rest: true,
  fields: [],
  owner: { owner: 'module `events`', file: 'src/modules/events/cms/events.ts' },
  tools: [],
  jobs: [],
  ...over,
})

const MODELS = [
  model('events', {
    purpose: 'Neighborhood events.',
    versions: ['Drafts: yes'],
    tools: ['findEvents'],
    fields: [
      row('title', 'text', { required: 'yes', notes: ['max length 60'] }),
      row('slug', 'text', { unique: true, indexed: true, notes: ['unique', 'indexed'] }),
      row('heroImage', 'upload', { detail: '→ media', link: { to: ['media'], many: false } }),
      row('categories', 'relationship', {
        detail: '→ categories (many)',
        link: { to: ['categories'], many: true },
      }),
      row('layout', 'blocks', { detail: 'blocks: cta, archive' }),
      row('layout{cta}', 'block'),
      row('layout{archive}', 'block'),
    ],
    hooks: [
      {
        phase: 'afterChange',
        name: 'revalidateEvent',
        note: '',
        file: 'src/modules/events/cms/revalidateEvent.ts',
      },
      {
        phase: 'afterChange',
        name: 'holdSuggestions',
        note: '',
        file: 'src/platform/payload/reviewQueue.ts',
      },
      { phase: 'afterChange', name: 'inline', note: '', file: '@payloadcms/plugin-search' },
    ],
  }),
  model('media', {
    owner: { owner: 'shared code `platform/payload`', file: 'src/platform/payload/media.ts' },
  }),
  model('categories', {
    owner: { owner: 'module `news`', file: 'src/modules/news/cms/categories.ts' },
  }),
  model('forms', {
    owner: {
      owner: 'the plugin',
      file: '',
      plugin: '@payloadcms/plugin-form-builder',
      modules: ['contact', 'verification'],
    },
    fields: [
      row('items', 'join', {
        detail: '← events.run',
        link: { collections: ['events'], on: 'run' },
      }),
    ],
  }),
  model('payload-kv', { owner: { owner: 'a plugin or Payload', file: '' } }),
  model('header', {
    kind: 'global',
    owner: { owner: 'module `site`', file: 'src/modules/site/cms/navGlobal.ts' },
  }),
]

const ownerOf = (file) => {
  const match = /^src\/(modules|platform)\/([^/]+)\//.exec(file)
  if (!match) return null
  const type = match[1] === 'modules' ? 'module' : 'platform-area'
  return { id: `${type}:${match[2]}`, top: `${type}:${match[2]}` }
}

describe('buildContentTypes', () => {
  const { nodes, edges, gaps } = buildContentTypes({
    models: MODELS,
    ownerOf,
    database: '@payloadcms/db-sqlite',
  })
  const byId = (id) => nodes.find((n) => n.id === id)
  const edge = (from, to, type) =>
    edges.find((e) => e.from === from && e.to === to && e.type === type)

  it('makes a collection or a global node of each content type, at its defining file', () => {
    expect(byId('collection:events')).toMatchObject({
      type: 'collection',
      name: 'events',
      summary: 'Neighborhood events.',
      path: 'src/modules/events/cms/events.ts',
      module: 'module:events',
      links: ['docs/reference/content-types/events.md'],
    })
    expect(byId('global:header').type).toBe('global')
  })

  it('points a plugin-made type at its page, and a built-in one at the Payload area', () => {
    expect(byId('collection:forms')).toMatchObject({
      path: 'docs/reference/content-types/forms.md',
      module: 'module:contact',
    })
    expect(byId('collection:payload-kv')).toMatchObject({ module: 'platform-area:payload' })
  })

  it('lists every field with its type, whether it is required and its notes', () => {
    expect(byId('collection:events').fields.slice(0, 3)).toEqual([
      { name: 'title', type: 'text', required: true, detail: '', notes: ['max length 60'] },
      { name: 'slug', type: 'text', required: false, detail: '', notes: ['unique', 'indexed'] },
      { name: 'heroImage', type: 'upload', required: false, detail: '→ media', notes: [] },
    ])
  })

  it('states the primary key, the unique and indexed fields, the database and the access', () => {
    const facts = Object.fromEntries(byId('collection:events').facts.map((f) => [f.label, f.value]))
    expect(facts['Primary key']).toBe('id (set by Payload)')
    expect(facts['Unique fields']).toBe('slug')
    expect(facts['Indexed fields']).toBe('slug')
    expect(facts.Access).toBe('read: anyone')
    expect(facts['Versions']).toBe('Drafts: yes')
    expect(facts['AI agent tools']).toBe('findEvents')
  })

  it('has each owner contain its content types', () => {
    expect(edge('module:events', 'collection:events', 'contains')).toBeDefined()
    expect(edge('platform-area:payload', 'collection:media', 'contains')).toBeDefined()
    expect(edge('platform-area:payload', 'collection:payload-kv', 'contains')).toBeDefined()
  })

  it('makes a references edge for each relationship or upload field, with its cardinality', () => {
    expect(edge('collection:events', 'collection:media', 'references')).toMatchObject({
      via: ['heroImage (one)'],
    })
    expect(edge('collection:events', 'collection:categories', 'references')).toMatchObject({
      via: ['categories (many)'],
    })
  })

  it('makes a joins edge from a join field', () => {
    expect(edge('collection:forms', 'collection:events', 'joins')).toMatchObject({
      via: ['items ← events.run'],
    })
  })

  it('makes a block node of each block a layout holds, contained once and used by the others', () => {
    expect(byId('block:cta')).toMatchObject({
      type: 'block',
      path: 'src/modules/events/cms/events.ts',
    })
    expect(edge('collection:events', 'block:cta', 'contains')).toBeDefined()
  })

  it("makes a hooks edge only for a hook written outside the type's own area", () => {
    expect(edge('platform-area:payload', 'collection:events', 'hooks')).toMatchObject({
      via: ['afterChange holdSuggestions'],
    })
    expect(edges.filter((e) => e.type === 'hooks')).toHaveLength(1)
  })

  it('has each content type use the database', () => {
    expect(edge('collection:events', 'library:@payloadcms/db-sqlite', 'uses')).toMatchObject({
      via: ['database'],
    })
  })

  it('lists a reference to a content type that does not exist as a gap', () => {
    const odd = buildContentTypes({
      models: [
        model('a', {
          fields: [row('x', 'relationship', { link: { to: ['ghost'], many: false } })],
        }),
      ],
      ownerOf,
      database: '',
    })
    expect(odd.gaps).toEqual([
      {
        kind: 'reference-target-missing',
        node: 'collection:a',
        message: 'field x points at "ghost", which is not a content type',
      },
    ])
  })
})
