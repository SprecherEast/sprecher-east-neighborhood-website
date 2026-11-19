import type { ArrayField, Field } from 'payload'
import { deepMergeWithSourceArrays } from 'payload/shared'

import type { LinkAppearances } from '@/platform/payload/link'

import { link } from '@/platform/payload/link'

type LinkGroupType = (options?: {
  appearances?: LinkAppearances[] | false
  overrides?: Partial<ArrayField>
}) => Field

export const linkGroup: LinkGroupType = ({ appearances, overrides = {} } = {}) => {
  const generatedLinkGroup: ArrayField = {
    name: 'links',
    type: 'array',
    fields: [
      link({
        appearances,
      }),
    ],
    admin: {
      initCollapsed: true,
    },
  }

  // An array in the overrides (such as `fields`) replaces the default one instead of adding to it
  return deepMergeWithSourceArrays<ArrayField>(generatedLinkGroup, overrides)
}
