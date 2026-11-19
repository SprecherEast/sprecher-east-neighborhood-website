import type { ArrayField, Block, TextFieldSingleValidation } from 'payload'
import { text } from 'payload/shared'

// `required` accepts a label of only spaces, which would leave a number with nothing beside it
export const validateLabel: TextFieldSingleValidation = (value, args) =>
  value && !value.trim() ? 'Add a label, or remove this marker.' : text(value, args)

/**
 * The list of markers, written once for the diagram key and the figure's key. `minRows` is the
 * fewest markers a key needs: 2 for a key of its own, 0 where the key is optional.
 */
export function diagramKeyItemsField({
  minRows = 2,
  required = true,
}: { minRows?: number; required?: boolean } = {}): ArrayField {
  return {
    name: 'items',
    type: 'array',
    labels: { singular: 'Marker', plural: 'Markers' },
    admin: {
      description: 'One per numbered marker on the image, in number order. Don’t type the numbers.',
    },
    minRows,
    maxRows: 9,
    required,
    fields: [
      {
        type: 'row',
        fields: [
          {
            name: 'label',
            type: 'text',
            required: true,
            maxLength: 40,
            validate: validateLabel,
            admin: { width: '40%', description: 'Short: "North roundabout".' },
          },
          {
            name: 'text',
            type: 'text',
            maxLength: 160,
            admin: { width: '60%', description: 'One line: what it is or does. Optional.' },
          },
        ],
      },
    ],
  }
}

/**
 * A numbered legend for an annotated image (#515): put it right under a picture whose markers
 * are numbered 1, 2, 3…, one item per marker, in the same order. Each item is a short bold
 * label and a line of text; the numbers come from the order, so editors never type them.
 */
export const DiagramKeyBlockConfig: Block = {
  slug: 'diagramKey',
  interfaceName: 'DiagramKeyBlock',
  labels: { singular: 'Diagram key', plural: 'Diagram keys' },
  fields: [diagramKeyItemsField()],
}
