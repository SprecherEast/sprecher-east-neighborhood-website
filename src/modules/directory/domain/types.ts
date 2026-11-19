import type { ImageRef, RichTextValue } from '@/platform/lib'

import type { FaqCategory, ResourceCategory } from './categories'

// Read-only lists the pages show as stored, so these mirror the collections' fields (optional
// fields stay optional) and the queries return them without a mapper (architecture rule 8).

/** A published question and its answer, as the FAQ page shows it. */
export type FaqEntry = {
  id: number
  question: string
  answer: RichTextValue
  /** No category means General */
  category?: FaqCategory | null
}

/** A published entry in the resources directory, as its card shows it. */
export type ResourceSummary = {
  id: number
  title: string
  description?: string | null
  /** Starts with http:// or https:// (`isResourceUrl`) */
  url?: string | null
  phone?: string | null
  category: ResourceCategory
  /** An elected official's portrait, used with their permission; an id until loaded (#393) */
  photo?: ImageRef | number | null
  /** Whose photo it is, without "Photo:"; required when `photo` is set */
  photoCredit?: string | null
  /** Where the photo came from, when it has a public page */
  photoSourceUrl?: string | null
  /** Up to three more links, such as the official's blog; each URL passes `isResourceUrl` */
  links?: ResourceLink[] | null
}

/** One extra link on a resource card. */
export type ResourceLink = {
  id?: string | null
  label: string
  url: string
}

/** One heading on the FAQ or resources page: a category, its label and what it holds. */
export type CategorySection<Category extends string, Item> = {
  category: Category
  label: string
  items: Item[]
}

/** The resources page's groups: a heading over the category sections that belong together. */
export type ResourceGroup<Category extends string, Item> = {
  id: string
  label: string
  sections: CategorySection<Category, Item>[]
}
