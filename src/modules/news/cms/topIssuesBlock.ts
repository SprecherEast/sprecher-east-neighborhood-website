import type { Block } from 'payload'

import { link } from '@/platform/payload/link'

import { TOP_ISSUES_DEFAULT_HEADING, TOP_ISSUES_LIMITS as LIMITS } from '../domain/topIssues'

/**
 * "Top issues" (#484): a short list editors keep, for the home page or any page. Each item is a
 * title, an optional one-sentence summary and one link: a post, a page or a full URL such as a
 * forum thread. The title is the link's text, so the link has no label or look of its own.
 */
export const TopIssuesBlock: Block = {
  slug: 'topIssues',
  interfaceName: 'TopIssuesBlock',
  labels: { singular: 'Top issues', plural: 'Top issues' },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      defaultValue: TOP_ISSUES_DEFAULT_HEADING,
    },
    {
      name: 'reviewedAt',
      type: 'date',
      label: 'Last reviewed',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description:
          'The day you last checked the list. Residents see "Updated" with this date; leave it empty to show none.',
      },
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: LIMITS.items.min,
      maxRows: LIMITS.items.max,
      labels: { singular: 'Issue', plural: 'Issues' },
      admin: {
        description:
          'Up to five, most important first. Drag to reorder. An issue whose post or page isn’t published is hidden.',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          maxLength: LIMITS.title.maxLength,
          admin: { description: 'A few words. It is the link residents tap.' },
        },
        {
          name: 'summary',
          type: 'textarea',
          maxLength: LIMITS.summary.maxLength,
          admin: { description: 'One sentence, shown below the title.' },
        },
        link({ appearances: false, disableLabel: true }),
      ],
    },
  ],
}
