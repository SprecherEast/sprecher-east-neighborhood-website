import type { NumberField } from 'payload'

/** The sidebar number that sorts a directory list (FAQ, resources, team): lower comes first. */
export const orderField = (description = 'Lower numbers appear first'): NumberField => ({
  name: 'order',
  type: 'number',
  defaultValue: 99,
  admin: { position: 'sidebar', description },
})
