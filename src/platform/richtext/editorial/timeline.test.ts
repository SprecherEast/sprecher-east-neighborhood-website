import { describe, expect, it } from 'vitest'

import { toTimelineProps } from './timeline'

describe('toTimelineProps', () => {
  it('maps stored milestones to plain props, trimmed, with resolved links', () => {
    expect(
      toTimelineProps({
        entries: [
          {
            date: ' Dec 5, 2024 ',
            status: 'done',
            title: ' Corridor decision ',
            description: ' WisDOT picked the route. ',
            linkLabel: 'Read the decision',
            linkUrl: 'https://example.com/decision',
          },
          { date: 'Not set', status: 'conditional', title: 'Cost deal', description: '' },
        ],
      }),
    ).toEqual({
      entries: [
        {
          date: 'Dec 5, 2024',
          status: 'done',
          title: 'Corridor decision',
          description: 'WisDOT picked the route.',
          link: {
            href: 'https://example.com/decision',
            label: 'Read the decision',
            external: true,
            appearance: 'default',
          },
        },
        {
          date: 'Not set',
          status: 'conditional',
          title: 'Cost deal',
          description: null,
          link: null,
        },
      ],
    })
  })

  it('drops untitled milestones and reads an unknown status as later', () => {
    const { entries } = toTimelineProps({
      entries: [
        { date: '2026', status: 'done', title: '  ' },
        { date: '2040s', status: 'someday' as never, title: 'Construction' },
      ],
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ title: 'Construction', status: 'later' })
  })

  it('handles a block with no milestones', () => {
    expect(toTimelineProps({ entries: [] })).toEqual({ entries: [] })
  })
})
