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
