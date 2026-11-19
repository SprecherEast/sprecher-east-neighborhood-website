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

describe('toContentBlockProps share bar (#1266)', () => {
  const bar = { schools: 50, city: 30, county: 15, matc: 5 }

  it('passes on four percents that add up to 100', () => {
    const props = toContentBlockProps({ columns: [column({ shareBar: bar })] })
    const columns = 'columns' in props ? props.columns : []
    expect(columns[0].shareBar).toEqual(bar)
  })

  it.each([
    ['one is missing', { ...bar, matc: null }],
    ['they do not add up', { ...bar, matc: 9 }],
    ['none is set', {}],
  ])('leaves the bar out when %s', (_why, shareBar) => {
    const props = toContentBlockProps({ columns: [column({ shareBar })] })
    const columns = 'columns' in props ? props.columns : []
    expect(columns[0].shareBar).toBeUndefined()
  })
})
