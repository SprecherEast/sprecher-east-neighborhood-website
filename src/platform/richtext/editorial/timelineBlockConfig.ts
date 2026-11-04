import type { ArrayFieldValidation, Block } from 'payload'
import { array } from 'payload/shared'

import { TIMELINE_LIMITS } from './editorialLimits'
import { editorialLinkFields } from './linkFields'
import { TIMELINE_STATUS_OPTIONS } from './timelineStatus'

// One milestone at most is "Next up": it's the reader's "you are here"
const validateEntries: ArrayFieldValidation = (value, args) => {
  const nextUp = Array.isArray(value)
    ? value.filter((entry) => (entry as { status?: string }).status === 'next').length
    : 0
  if (nextUp > 1) return 'Mark only one milestone as "Next up".'
  return array(value, args)
}

/**
 * The timeline an editor puts inside rich text (#507): milestones in order, each with a date
 * label, a title, a short description, a status and at most one link. It follows the MOJ and DWP
 * design systems' timeline (date first, one marker per entry, one link per entry).
 */
export const TimelineBlockConfig: Block = {
  slug: 'timeline',
  interfaceName: 'TimelineBlock',
  labels: { singular: 'Timeline', plural: 'Timelines' },
  fields: [
    {
      name: 'entries',
      type: 'array',
      label: 'Milestones',
      labels: { singular: 'Milestone', plural: 'Milestones' },
      admin: {
        description: 'In the order they happen, oldest first. Two to twelve milestones.',
      },
      minRows: TIMELINE_LIMITS.minEntries,
      maxRows: TIMELINE_LIMITS.maxEntries,
      required: true,
      validate: validateEntries,
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'date',
              type: 'text',
              label: 'When',
              required: true,
              maxLength: TIMELINE_LIMITS.date,
              admin: {
                width: '50%',
                description: 'As readers should see it: "Dec 5, 2024", "Spring 2027", "Not set".',
              },
            },
            {
              name: 'status',
              type: 'select',
              required: true,
              defaultValue: 'later',
              options: TIMELINE_STATUS_OPTIONS,
              admin: { width: '50%' },
            },
          ],
        },
        { name: 'title', type: 'text', required: true, maxLength: TIMELINE_LIMITS.title },
        {
          name: 'description',
          type: 'textarea',
          maxLength: TIMELINE_LIMITS.description,
          admin: { description: 'One or two plain sentences. Optional.' },
        },
        editorialLinkFields({ labelExample: 'Read the decision' }),
      ],
    },
  ],
}
