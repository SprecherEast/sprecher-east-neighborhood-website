import type { ResourceCategory } from './categories'

/** A group of resources: its own page, a menu entry, and the categories whose resources it lists. */
export type ResourceGroupDefinition = {
  /** The group's address under `/resources` */
  readonly id: string
  readonly label: string
  readonly categories: readonly ResourceCategory[]
}

/**
 * The groups the resources are organised into, in the order the menu and the related links show
 * them, and the categories each holds. Every category is in exactly one group (a test checks it).
 * Resources filed under Other, or under a category no longer listed, are with Community and family.
 */
export const RESOURCE_GROUPS = [
  { id: 'utilities', label: 'Neighborhood utilities', categories: ['utilities'] },
  { id: 'government', label: 'Government', categories: ['elected-officials'] },
  { id: 'safety-health', label: 'Safety and health', categories: ['public-safety'] },
  { id: 'housing-renting', label: 'Housing and renting', categories: ['renting'] },
  {
    id: 'community-family',
    label: 'Community and family',
    categories: ['childcare', 'parks', 'community', 'other'],
  },
] as const satisfies readonly ResourceGroupDefinition[]

/** The address of one group's page */
export function resourceGroupHref(id: string): string {
  return `/resources/${id}`
}
