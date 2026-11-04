import type { Field, TextFieldSingleValidation } from 'payload'

import { EDITORIAL_LINK_MAX_LENGTH, validateEditorialLink } from './editorialLink'

// The address is checked together with its link text: both or neither
const validateLinkUrl: TextFieldSingleValidation = (value, { siblingData }) =>
  validateEditorialLink(value, (siblingData as { linkLabel?: string | null }).linkLabel)

/**
 * The optional link an editorial block item carries: link text and an address side by side,
 * stored as `linkLabel` and `linkUrl` (`toEditorialLink()` reads them). Shared by every block in
 * `EDITORIAL_BLOCKS`, so they all validate links the same way.
 */
export const editorialLinkFields = ({
  labelExample = 'Read more',
  labelMaxLength = 60,
  urlMaxLength = EDITORIAL_LINK_MAX_LENGTH,
}: { labelExample?: string; labelMaxLength?: number; urlMaxLength?: number } = {}): Field => ({
  type: 'row',
  fields: [
    {
      name: 'linkLabel',
      type: 'text',
      label: 'Link text',
      maxLength: labelMaxLength,
      admin: { width: '50%', description: `Optional, for example "${labelExample}".` },
    },
    {
      name: 'linkUrl',
      type: 'text',
      label: 'Link address',
      maxLength: urlMaxLength,
      admin: { width: '50%', description: 'A site path (/events) or https:// address.' },
      validate: validateLinkUrl,
    },
  ],
})
