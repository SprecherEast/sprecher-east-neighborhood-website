import type { NamedTab } from 'payload'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

/**
 * The "SEO" tab of a page, post or event: the SEO plugin's overview, title, image, description
 * and preview fields, stored under `meta`. One definition, so the three collections cannot drift.
 */
export function seoTab(): NamedTab {
  return {
    name: 'meta',
    label: 'SEO',
    fields: [
      OverviewField({
        titlePath: 'meta.title',
        descriptionPath: 'meta.description',
        imagePath: 'meta.image',
      }),
      MetaTitleField({ hasGenerateFn: true }),
      MetaImageField({ relationTo: 'media' }),
      MetaDescriptionField({}),
      PreviewField({
        hasGenerateFn: true,
        titlePath: 'meta.title',
        descriptionPath: 'meta.description',
      }),
    ],
  }
}
