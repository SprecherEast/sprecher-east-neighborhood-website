import { describe, expect, it } from 'vitest'

import type { SectionBlock } from '@/payload-types'

import { toPageLayout } from './mappers'

const section = (items: SectionBlock['items']): SectionBlock => ({
  blockType: 'section',
  id: 's1',
  items,
})

describe('the section block as plain props (#884)', () => {
  it('maps each item’s layout and the blocks it holds, as plain props', () => {
    const [block] = toPageLayout([
      section([
        {
          width: 'twoThirds',
          align: 'start',
          verticalAlign: 'top',
          phoneOrder: 'inOrder',
          content: [
            {
              blockType: 'mapBlock',
              id: 'm',
              title: 'Where we are',
              description: 'Our boundary.',
              embedUrl: 'https://example.com/not-google',
              preview: 3,
            },
          ],
        },
        {
          width: 'oneThird',
          align: 'end',
          verticalAlign: 'center',
          phoneOrder: 'first',
          content: [],
        },
      ]),
    ])

    expect(block).toMatchObject({
      blockType: 'section',
      items: [
        {
          width: 'twoThirds',
          align: 'start',
          verticalAlign: 'top',
          phoneOrder: 'inOrder',
          blocks: [{ blockType: 'mapBlock', title: 'Where we are' }],
        },
        { width: 'oneThird', align: 'end', verticalAlign: 'center', phoneOrder: 'first', blocks: [] },
      ],
    })
    // A nested block is mapped like any other: the unsafe address is dropped
    const nested = (block as { items: { blocks: object[] }[] }).items[0].blocks[0]
    expect(nested).not.toHaveProperty('embedUrl')
  })

  it('treats an item with no content as an empty item', () => {
    const [block] = toPageLayout([
      section([
        { width: 'full', align: 'start', verticalAlign: 'top', phoneOrder: 'inOrder', content: null },
      ]),
    ])
    expect(block).toMatchObject({ items: [{ blocks: [] }] })
  })
})
