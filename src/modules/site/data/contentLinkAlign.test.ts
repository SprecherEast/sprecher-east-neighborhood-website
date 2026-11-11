import { describe, expect, it } from 'vitest'

import type { ContentBlock } from '@/payload-types'

import { toContentBlockProps } from './mappers'

type Column = NonNullable<ContentBlock['columns']>[number]

const link = { type: 'custom', url: '/events', label: 'See events', appearance: 'outline' } as const
const column = (extra: Partial<Column>): Column => ({ size: 'full', ...extra })

describe('toContentBlockProps link position', () => {
  it('passes on a link button placed at the end, and says nothing for the start', () => {
    const props = toContentBlockProps({
      columns: [
        column({ enableLink: true, link, linkAlign: 'end' }),
        column({ enableLink: true, link, linkAlign: 'start' }),
        column({ enableLink: false, link, linkAlign: 'end' }),
      ],
    })

    expect(props.layout).toBe('single')
    const columns = 'columns' in props ? props.columns : []
    expect(columns.map((c) => c.linkAlign)).toEqual(['end', undefined, undefined])
  })

  it('passes on a link button placed beside the text (#1058)', () => {
    const props = toContentBlockProps({
      columns: [column({ enableLink: true, link, linkAlign: 'beside' })],
    })

    const columns = 'columns' in props ? props.columns : []
    expect(columns.map((c) => c.linkAlign)).toEqual(['beside'])
  })
})
