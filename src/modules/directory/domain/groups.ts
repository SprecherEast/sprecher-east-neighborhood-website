import type { ResourceCategory } from './categories'

/** A group on the resources page: a heading over the categories that belong together. */
export type ResourceGroupDefinition = {
  /** The anchor the group's heading and its jump link share */
  readonly id: string
  readonly label: string
  readonly categories: readonly ResourceCategory[]
}

/**
 * The groups the resources page is organised into, in the order it shows them, and the categories
 * each holds. Every category is in exactly one group (a test checks it). Resources the editors
 * file under Other, or under a category no longer listed, follow in a last group of their own.
 */
export const RESOURCE_GROUPS = [
  { id: 'utilities', label: 'Neighborhood utilities', categories: ['utilities'] },
  { id: 'government', label: 'Government', categories: ['elected-officials'] },
  { id: 'safety-health', label: 'Safety and health', categories: ['public-safety'] },
  {
    id: 'housing-neighborhood',
    label: 'Housing and neighborhood',
    categories: ['renting', 'childcare', 'parks', 'community'],
  },
  { id: 'other', label: 'Other', categories: ['other'] },
] as const satisfies readonly ResourceGroupDefinition[]
