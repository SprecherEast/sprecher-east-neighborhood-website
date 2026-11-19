import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import { MEDIA_LICENSES } from '@/platform/lib/mediaLicenses'
import { isHttpUrl } from '@/platform/lib/reviewQueue'
import { anyone } from '@/platform/payload/anyone'
import { isAdmin, isAdminOrEditor } from '@/platform/payload/roles'

/** An optional link field: empty, or a full http(s) link. */
const optionalHttpUrl = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  isHttpUrl(value) ||
  'Enter a full http(s) link.'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  slug: 'media',
  folders: true,
  access: {
    create: isAdminOrEditor,
    delete: isAdmin,
    read: anyone,
    update: isAdminOrEditor,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
    {
      name: 'credit',
      type: 'text',
      maxLength: 200,
      admin: {
        description: 'Who made the image, as it should be credited, for example "Jane Doe".',
      },
    },
    {
      name: 'license',
      type: 'select',
      options: [...MEDIA_LICENSES],
      admin: { description: 'Under what terms the site may show it.' },
    },
    {
      name: 'licenseUrl',
      type: 'text',
      label: 'License link',
      maxLength: 2048,
      validate: optionalHttpUrl,
      admin: {
        description:
          'The license itself, for example https://creativecommons.org/licenses/by-sa/4.0/. Creative Commons licenses need it: the photo credit links to it.',
      },
    },
    {
      name: 'sourceUrl',
      type: 'text',
      label: 'Source link',
      maxLength: 2048,
      validate: optionalHttpUrl,
      admin: { description: 'Where the image came from, when it isn’t our own.' },
    },
  ],
  upload: {
    // Upload to the public/media directory in Next.js making them publicly accessible even outside of Payload
    // (this file is src/platform/payload/, three levels below the project root)
    staticDir: path.resolve(dirname, '../../../public/media'),
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
      },
      {
        name: 'square',
        width: 500,
        height: 500,
      },
      {
        name: 'small',
        width: 600,
      },
      {
        name: 'medium',
        width: 900,
      },
      {
        name: 'large',
        width: 1400,
      },
      {
        name: 'xlarge',
        width: 1920,
      },
      {
        name: 'og',
        width: 1200,
        height: 630,
        crop: 'center',
      },
    ],
  },
}
