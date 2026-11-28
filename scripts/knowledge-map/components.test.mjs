import { describe, expect, it } from 'vitest'

import { buildComponents } from './components.mjs'

const components = [
  {
    name: 'Button',
    file: 'src/platform/ui/Button.tsx',
    description: 'The only thing that draws a button.',
    props: [
      { name: 'variant', type: '"primary" | "outline"', optional: true, doc: '', variant: true },
      {
        name: 'children',
        type: 'React.ReactNode',
        optional: false,
        doc: 'The label',
        variant: false,
      },
    ],
    inherited: 12,
    parts: [],
  },
  {
    name: 'Chart',
    file: 'src/platform/ui/chart/Chart.tsx',
    description: '',
    props: [],
    inherited: 0,
    parts: [],
  },
  {
    name: 'RichText',
    file: 'src/platform/richtext/RichText.tsx',
    description: '',
    props: [],
    inherited: 0,
    parts: [],
  },
]
const users = new Map([
  [
    'Button',
    [
      'src/app/(frontend)/faq/page.tsx',
      'src/modules/events/ui/EventCard.tsx',
      'src/modules/events/ui/Other.tsx',
      'src/platform/ui/Card.tsx',
    ],
  ],
  ['Chart', ['src/modules/news/ui/Post.tsx']],
  ['RichText', []],
])
const ownerOf = (file) => {
  const feature = /^src\/platform\/ui\/chart\//.test(file)
  const match = /^src\/(modules|platform)\/([^/]+)\//.exec(file)
  if (!match) return null
  const type = match[1] === 'modules' ? 'module' : 'platform-area'
  const top = `${type}:${match[2]}`
  return { id: feature ? 'feature:platform/ui/chart' : top, top }
}
const screenByFile = new Map([['src/app/(frontend)/faq/page.tsx', 'screen:/faq']])

describe('buildComponents', () => {
  const { nodes, edges } = buildComponents({ components, users, ownerOf, screenByFile })
  const byId = (id) => nodes.find((n) => n.id === id)
  const edge = (from, to, type) =>
    edges.find((e) => e.from === from && e.to === to && e.type === type)

  it('makes a node of each shared component at its file, with its props as fields', () => {
    expect(byId('shared-component:Button')).toMatchObject({
      type: 'shared-component',
      path: 'src/platform/ui/Button.tsx',
      module: 'platform-area:ui',
      summary: 'The only thing that draws a button.',
      fields: [
        {
          name: 'variant',
          type: '"primary" | "outline"',
          required: false,
          detail: '',
          notes: ['variant'],
        },
        {
          name: 'children',
          type: 'React.ReactNode',
          required: true,
          detail: 'The label',
          notes: [],
        },
      ],
    })
  })

  it('says how many more props it takes from its element', () => {
    expect(byId('shared-component:Button').facts).toContainEqual({
      label: 'Props from its element',
      value: '12',
    })
  })

  it('is contained by the deepest area, and by the top one when none is deeper', () => {
    expect(edge('feature:platform/ui/chart', 'shared-component:Chart', 'contains')).toBeDefined()
    expect(edge('platform-area:ui', 'shared-component:Button', 'contains')).toBeDefined()
  })

  it('has each screen render a component it imports, and each module use one, once per file', () => {
    expect(edge('screen:/faq', 'shared-component:Button', 'renders')).toBeDefined()
    expect(edges.filter((e) => e.from === 'module:events' && e.type === 'uses')).toHaveLength(2)
    expect(edge('module:news', 'shared-component:Chart', 'uses')).toBeDefined()
  })

  it("leaves out a use inside the component's own area", () => {
    expect(
      edges.some(
        (e) =>
          e.from === 'platform-area:ui' && e.to === 'shared-component:Button' && e.type === 'uses',
      ),
    ).toBe(false)
  })
})
