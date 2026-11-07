import type { Block } from 'payload'

import { diagramKeyItemsField } from './diagramKeyBlockConfig'

/**
 * A small picture that floats right in the article, with its numbered key in a dialog (#817).
 * The picture, a label ("Figure 2-9"), a short caption under it, and, shown only when a reader
 * enlarges it, a longer caption and the numbered key. Editors add it in Admin with no code.
 */
export const FigureBlockConfig: Block = {
  slug: 'figure',
  interfaceName: 'FigureBlock',
  labels: { singular: 'Figure', plural: 'Figures' },
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: { description: 'The large picture. It shows small in the article.' },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 80,
      admin: {
        description: 'What the picture shows, in a few words. It names the Enlarge button.',
      },
    },
    {
      name: 'label',
      type: 'text',
      maxLength: 30,
      admin: { description: 'Its number in the source, such as "Figure 2-9". Optional.' },
    },
    {
      name: 'caption',
      type: 'text',
      maxLength: 120,
      admin: { description: 'One short line under the small picture. Optional.' },
    },
    {
      name: 'longCaption',
      type: 'textarea',
      maxLength: 400,
      admin: {
        description:
          'Source, how it was made and conditions. Shown only when the picture is enlarged. Optional.',
      },
    },
    {
      name: 'size',
      type: 'select',
      defaultValue: 'two-fifths',
      options: [
        { label: 'Two fifths of the text (default)', value: 'two-fifths' },
        { label: 'One third', value: 'third' },
        { label: 'Half', value: 'half' },
      ],
      admin: { description: 'How wide it is beside the text on a tablet or larger.' },
    },
    diagramKeyItemsField({ minRows: 2, required: false }),
  ],
}
