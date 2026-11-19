/** A select option: the value stored and the label editors and visitors see. */
type CategoryOption = { readonly value: string; readonly label: string }

/**
 * Every FAQ category, in the order the FAQ page shows them, with its label. The collection's
 * options too, so the stored values and the page's headings can't drift apart.
 */
export const FAQ_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'membership', label: 'Membership' },
  { value: 'events', label: 'Events' },
  { value: 'neighborhood', label: 'Neighborhood' },
] as const satisfies readonly CategoryOption[]

export type FaqCategory = (typeof FAQ_CATEGORIES)[number]['value']

/** Every resource category, in the order the resources page shows them. The collection's too. */
export const RESOURCE_CATEGORIES = [
  { value: 'elected-officials', label: 'Elected Officials' },
  { value: 'public-safety', label: 'Public Safety' },
  { value: 'childcare', label: 'Childcare & Education' },
  { value: 'renting', label: 'Renting & Housing' },
  { value: 'parks', label: 'Parks & Recreation' },
  { value: 'community', label: 'Community Organizations' },
  { value: 'utilities', label: 'Utilities & Services' },
  { value: 'other', label: 'Other' },
] as const satisfies readonly CategoryOption[]

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]['value']

/**
 * A line under a resource section's heading, for the sections that need one. Officials' photos
 * next to the site could read as an endorsement (the owner's concern, 2026-10-31, #393).
 */
export const RESOURCE_SECTION_NOTES: Partial<Record<ResourceCategory, string>> = {
  'elected-officials':
    'Photos are used with each official’s permission. Listing someone here is not an endorsement.',
}
