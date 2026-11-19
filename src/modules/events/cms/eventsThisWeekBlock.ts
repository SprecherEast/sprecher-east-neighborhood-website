import type { Block } from 'payload'

import {
  THIS_WEEK_DEFAULT_HEADING,
  THIS_WEEK_LIMITS as LIMITS,
  type ThisWeekSource,
} from '../domain/thisWeek'

const SOURCE_OPTIONS: { label: string; value: ThisWeekSource }[] = [
  { label: 'Every upcoming event', value: 'all' },
  { label: 'Official meetings', value: 'official' },
  { label: 'One category', value: 'category' },
]

/**
 * The "this week" strip (#122): the next few days of events in rows, for the home page or any
 * page. A new block starts with three rows; the editor picks the Family row's category.
 */
export const EventsThisWeekBlock: Block = {
  slug: 'eventsThisWeek',
  interfaceName: 'EventsThisWeekBlock',
  labels: { singular: 'Events this week', plural: 'Events this week' },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      defaultValue: THIS_WEEK_DEFAULT_HEADING,
    },
    {
      name: 'days',
      type: 'number',
      label: 'Days ahead',
      required: true,
      min: LIMITS.days.min,
      max: LIMITS.days.max,
      defaultValue: LIMITS.days.default,
      admin: {
        step: 1,
        description:
          'How many days the strip shows, starting today. 7 shows today and the next six days.',
      },
    },
    {
      name: 'rows',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: LIMITS.rows.max,
      admin: {
        description:
          'Each row lists its events, soonest first. A row with no events in those days is hidden; when every row is empty, the strip says so and links to all events.',
      },
      defaultValue: [
        { title: 'Coming up', source: 'all', limit: LIMITS.limit.default },
        { title: 'Civic and official', source: 'official', limit: LIMITS.limit.default },
        { title: 'Family', source: 'category', limit: LIMITS.limit.default },
      ],
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'source',
          type: 'select',
          label: 'Events to show',
          required: true,
          defaultValue: 'all',
          options: SOURCE_OPTIONS,
        },
        {
          name: 'category',
          type: 'relationship',
          relationTo: 'categories',
          required: true,
          admin: {
            condition: (_, siblingData) => siblingData?.source === 'category',
            description: 'The row lists this category’s events and links to its events page.',
          },
        },
        {
          name: 'limit',
          type: 'number',
          label: 'Most events shown',
          required: true,
          min: LIMITS.limit.min,
          max: LIMITS.limit.max,
          defaultValue: LIMITS.limit.default,
          admin: { step: 1 },
        },
      ],
    },
  ],
}
