import type { Block } from 'payload'

import { toGoogleMapsEmbedUrl } from '@/platform/lib/googleMapsEmbed'

/**
 * A map with its text (#764): a small picture on the page and a live Google map when a neighbor
 * taps it. Only a Google map embed address is accepted, which needs no key and no billing: Maps
 * "Share → Embed a map", or a shared My Maps map.
 */
export const MapBlock: Block = {
  slug: 'mapBlock',
  interfaceName: 'MapBlock',
  labels: { singular: 'Map', plural: 'Maps' },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 80,
      admin: {
        description: 'Names the map for screen readers, for example "Where Sprecher East is".',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      admin: {
        description:
          'Says in words what the map shows: its boundaries and what touches them. Neighbors who cannot use the map read this.',
      },
    },
    {
      name: 'preview',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: { description: 'The small picture of the map, shown on the page.' },
    },
    {
      name: 'embedUrl',
      type: 'text',
      label: 'Google map address',
      admin: {
        description:
          'The live map opened by a tap. In Google Maps choose Share, then Embed a map, and paste the whole code or only its address. A shared My Maps map works too. Leave empty to show the picture only.',
      },
      hooks: {
        // A pasted iframe is stored as its address alone
        beforeValidate: [({ value }) => toGoogleMapsEmbedUrl(value) ?? value],
      },
      validate: (value: string | null | undefined) =>
        !value || toGoogleMapsEmbedUrl(value)
          ? true
          : 'Paste a Google Maps embed address (https://www.google.com/maps/embed… or …/maps/d/embed…).',
    },
  ],
}
