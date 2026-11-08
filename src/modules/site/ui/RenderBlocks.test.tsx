// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { PageLayoutBlock } from '../use-cases/getPageBySlug'
import { type PageBlockComponents, RenderBlocks } from './RenderBlocks'

afterEach(cleanup)

/** A stand-in for each block type's component that names the type and the props it got. */
const stub = (name: string) => {
  const Stub = ({
    id,
    disableInnerContainer,
  }: {
    id?: string | null
    disableInnerContainer?: boolean
  }) => <section data-block={name} data-id={id ?? ''} data-inner={String(disableInnerContainer)} />
  return Stub
}

const components: PageBlockComponents = {
  archive: stub('archive'),
  content: stub('content'),
  cta: stub('cta'),
  formBlock: stub('formBlock'),
  mediaBlock: stub('mediaBlock'),
  mapBlock: stub('mapBlock'),
  eventsThisWeek: stub('eventsThisWeek'),
  topIssues: stub('topIssues'),
}

// The layout as the page's use case returns it: site's blocks as plain props, the others as stored
const blocks = [
  { blockType: 'cta', id: 'a', links: [] },
  { blockType: 'content', id: 'b', layout: 'single', columns: [] },
  { blockType: 'mediaBlock', id: 'c', media: 1 },
  { blockType: 'mapBlock', id: 'h', title: 'Where we are', description: 'The map' },
  { blockType: 'archive', id: 'd', postQuery: {} },
  { blockType: 'formBlock', id: 'e', form: 1, enableIntro: false },
  { blockType: 'eventsThisWeek', id: 'f', heading: 'This week', days: 7, rows: [] },
  { blockType: 'topIssues', id: 'g', heading: 'Top issues', items: [] },
] as PageLayoutBlock[]

const drawn = (container: HTMLElement) =>
  [...container.querySelectorAll('section')].map((section) => section.dataset)

describe('RenderBlocks', () => {
  it('draws every block, in order, with the component for its type', () => {
    const { container } = render(<RenderBlocks blocks={blocks} components={components} />)

    expect(drawn(container).map(({ block, id }) => [block, id])).toEqual([
      ['cta', 'a'],
      ['content', 'b'],
      ['mediaBlock', 'c'],
      ['mapBlock', 'h'],
      ['archive', 'd'],
      ['formBlock', 'e'],
      ['eventsThisWeek', 'f'],
      ['topIssues', 'g'],
    ])
  })

  it('tells every block it sits in the page’s own container', () => {
    const { container } = render(<RenderBlocks blocks={blocks} components={components} />)

    expect(drawn(container).every(({ inner }) => inner === 'true')).toBe(true)
  })

  it('wraps each block in its own element', () => {
    const { container } = render(<RenderBlocks blocks={blocks} components={components} />)

    const wrappers = [...container.children]
    expect(wrappers).toHaveLength(blocks.length)
    expect(
      wrappers.every((el) => el.tagName === 'DIV' && el.firstElementChild?.tagName === 'SECTION'),
    ).toBe(true)
  })

  it('skips a block of a type it doesn’t know', () => {
    const unknown = [{ blockType: 'gallery', id: 'x' }] as unknown as PageLayoutBlock[]
    const { container } = render(<RenderBlocks blocks={unknown} components={components} />)

    expect(container.innerHTML).toBe('')
  })

  it('draws nothing for an empty layout', () => {
    const { container } = render(<RenderBlocks blocks={[]} components={components} />)

    expect(container.innerHTML).toBe('')
  })
})

describe('RenderBlocks: a section (#884)', () => {
  const section = {
    blockType: 'section',
    id: 's',
    items: [
      {
        width: 'twoThirds',
        align: 'start',
        verticalAlign: 'top',
        phoneOrder: 'inOrder',
        blocks: [{ blockType: 'content', id: 'in1', layout: 'single', columns: [] }],
      },
      {
        width: 'oneThird',
        align: 'end',
        verticalAlign: 'center',
        phoneOrder: 'first',
        blocks: [{ blockType: 'mapBlock', id: 'in2', title: 'Map', description: 'Map text' }],
      },
    ],
  } as unknown as PageLayoutBlock

  it('draws each item’s blocks with the page’s own components, inside the item', () => {
    const { container } = render(<RenderBlocks blocks={[section]} components={components} />)

    expect(
      [...container.querySelectorAll<HTMLElement>('[data-block]')].map(({ dataset }) => [
        dataset.block,
        dataset.id,
      ]),
    ).toEqual([
      ['content', 'in1'],
      ['mapBlock', 'in2'],
    ])
  })

  it('applies each item’s layout choices to its cell', () => {
    const { container } = render(<RenderBlocks blocks={[section]} components={components} />)
    const cells = [...container.querySelectorAll('[data-block]')].map(
      (el) => el.closest('[class*="col-span"]') as HTMLElement,
    )

    expect(cells[0].className).toContain('lg:col-span-8')
    expect(cells[1].className).toContain('lg:col-span-4')
    expect(cells[1].className).toContain('order-first')
  })

  it('tells the blocks inside an item they sit inline, and the page’s own blocks they do not', () => {
    const placements = (blocks: PageLayoutBlock[]) => {
      const seen: (string | undefined)[] = []
      const Spy = ({ placement }: { placement?: string }) => {
        seen.push(placement)
        return <section />
      }
      render(
        <RenderBlocks
          blocks={blocks}
          components={{ ...components, content: Spy as PageBlockComponents['content'] }}
        />,
      )
      return seen
    }
    const inner = { blockType: 'content', id: 'x', layout: 'single', columns: [] }
    const nested = {
      ...section,
      items: [{ ...(section as { items: object[] }).items[0], blocks: [inner] }],
    } as unknown as PageLayoutBlock

    expect(placements([inner as unknown as PageLayoutBlock])).toEqual(['section'])
    expect(placements([nested])).toEqual(['inline'])
  })
})
