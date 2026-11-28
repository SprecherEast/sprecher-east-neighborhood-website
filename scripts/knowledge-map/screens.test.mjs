import { describe, expect, it } from 'vitest'

import { buildScreens } from './screens.mjs'

const route = (url, file, entries = [], over = {}) => ({
  url,
  kind: 'page',
  file: `src/app/(frontend)/${file}`,
  entries,
  rendering: 'not stated',
  revalidate: '600',
  staticParams: false,
  metadata: 'inherited from the layout',
  methods: [],
  ...over,
})

const ROUTES = [
  route('/', 'page.tsx'),
  route('/events', 'events/(index)/page.tsx', ['@/modules/events/server']),
  route(
    '/events/[slug]',
    'events/[slug]/page.tsx',
    ['@/modules/events', '@/modules/events/server', '@/modules/site/server'],
    { staticParams: true },
  ),
  route('/faq', 'faq/page.tsx', ['@/modules/directory']),
  route('/api/version', 'api/version/route.ts', [], { kind: 'route handler', methods: ['GET'] }),
  route('/dev/gallery', 'dev/gallery/page.tsx'),
]
const ADMIN = [
  { url: '/admin/[[...segments]]', file: 'src/app/(payload)/admin/[[...segments]]/page.tsx' },
]
const MODULES = ['module:directory', 'module:events', 'module:site']

describe('buildScreens', () => {
  const { nodes, edges, gaps, screenByFile } = buildScreens({
    routes: ROUTES,
    adminPages: ADMIN,
    moduleIds: MODULES,
    contentTypeIds: ['collection:events', 'global:header'],
    siteId: 'site:sprecher-east',
  })
  const byId = (id) => nodes.find((n) => n.id === id)
  const edge = (from, to, type) =>
    edges.find((e) => e.from === from && e.to === to && e.type === type)

  it('makes a screen of each page and leaves route handlers to the endpoints', () => {
    expect(nodes.filter((n) => n.type === 'screen').map((n) => n.id)).toEqual([
      'screen:/',
      'screen:/events',
      'screen:/events/[slug]',
      'screen:/faq',
      'screen:/dev/gallery',
      'screen:/admin/[[...segments]]',
    ])
  })

  it('gives a screen its file, its module and what the route file says about it', () => {
    expect(byId('screen:/events/[slug]')).toMatchObject({
      path: 'src/app/(frontend)/events/[slug]/page.tsx',
      module: 'module:events',
      facts: [
        { label: 'Address', value: '/events/[slug]' },
        { label: 'Rendering', value: 'not stated' },
        { label: 'Revalidate (s)', value: '600' },
        { label: 'Pages built ahead', value: 'yes' },
        { label: 'Metadata', value: 'inherited from the layout' },
        {
          label: 'Module entry points',
          value: '@/modules/events, @/modules/events/server, @/modules/site/server',
        },
      ],
    })
  })

  it('groups screens that share a first address segment into a cluster, held by the module most of them use', () => {
    expect(byId('page-cluster:/events')).toMatchObject({
      type: 'page-cluster',
      path: 'src/app/(frontend)/events',
      module: 'module:events',
    })
    expect(edge('module:events', 'page-cluster:/events', 'contains')).toBeDefined()
    expect(edge('page-cluster:/events', 'screen:/events/[slug]', 'contains')).toBeDefined()
  })

  it('holds a screen that is alone in its segment by its module, and one with no module by the site', () => {
    expect(byId('page-cluster:/faq')).toBeUndefined()
    expect(edge('module:directory', 'screen:/faq', 'contains')).toBeDefined()
    expect(edge('site:sprecher-east', 'screen:/', 'contains')).toBeDefined()
    expect(edge('site:sprecher-east', 'screen:/dev/gallery', 'contains')).toBeDefined()
  })

  it('has a screen use each module it imports', () => {
    expect(edge('screen:/events/[slug]', 'module:site', 'uses')).toBeDefined()
    expect(edge('screen:/events/[slug]', 'module:events', 'uses')).toBeDefined()
  })

  it("names as a screen's module the one most screens of its first address segment import, alphabetical on a tie, and still uses each module it imports", () => {
    const tied = buildScreens({
      routes: [
        route('/confirm-email', 'confirm-email/page.tsx', [
          '@/modules/verification',
          '@/modules/accounts',
        ]),
      ],
      adminPages: [],
      moduleIds: ['module:accounts', 'module:verification'],
      contentTypeIds: [],
      siteId: 'site:sprecher-east',
    })
    expect(tied.nodes.find((n) => n.id === 'screen:/confirm-email').module).toBe('module:accounts')
    const uses = tied.edges.filter((e) => e.type === 'uses').map((e) => e.to)
    expect(uses).toEqual(['module:accounts', 'module:verification'])
  })

  it('has the Admin screen edit every content type', () => {
    expect(edge('screen:/admin/[[...segments]]', 'collection:events', 'edits')).toMatchObject({
      via: ['/admin/collections/events'],
    })
    expect(edge('screen:/admin/[[...segments]]', 'global:header', 'edits')).toMatchObject({
      via: ['/admin/globals/header'],
    })
  })

  it('lists a page that imports no module entry point as a gap, but not the Admin screen', () => {
    expect(gaps.map((g) => g.node)).toEqual(['screen:/', 'screen:/dev/gallery'])
  })

  it('maps a route file to its screen, for the components that screen draws', () => {
    expect(screenByFile.get('src/app/(frontend)/faq/page.tsx')).toBe('screen:/faq')
  })
})
