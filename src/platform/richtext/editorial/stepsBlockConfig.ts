import type { Block } from 'payload'

import { editorialLinkFields } from './linkFields'

/**
 * Numbered steps a reader can follow, in order (#508): a short heading and a sentence or two each,
 * with one optional link. It follows the USWDS process list (an ordered list of 3 to 10 steps,
 * short parallel headings); two steps are allowed for the shortest "how to take part".
 */
export const StepsBlockConfig: Block = {
  slug: 'steps',
  interfaceName: 'StepsBlock',
  labels: { singular: 'Steps', plural: 'Steps' },
  fields: [
    {
      name: 'steps',
      type: 'array',
      labels: { singular: 'Step', plural: 'Steps' },
      admin: {
        description: 'In the order a reader does them. Keep headings short and alike: "Join…".',
      },
      minRows: 2,
      maxRows: 10,
      required: true,
      fields: [
        { name: 'heading', type: 'text', required: true, maxLength: 80 },
        {
          name: 'body',
          type: 'textarea',
          maxLength: 300,
          admin: { description: 'One or two plain sentences. Optional.' },
        },
        editorialLinkFields({ labelExample: 'Find your alder' }),
      ],
    },
  ],
}
