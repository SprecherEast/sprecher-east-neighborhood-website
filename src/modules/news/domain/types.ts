import type { BandBackdrop, ImageRef, RichTextValue } from '@/platform/lib'

/** A category a post belongs to, as cards and the post hero name it. */
export type PostCategory = {
  id: number
  title: string
}

/**
 * Where a post's news came from first (#483), as readers see it: a name, and a link to the
 * original when the post has a safe one (an absolute http or https address).
 */
export type PostSource = {
  name: string
  url: string | null
}

/** What a post card or sidebar item shows. */
export type PostSummary = {
  id: number
  slug: string
  /** Where the card links: the post's page, or the event's for an event in search results */
  href: string
  title: string
  publishedAt: string | null
  categories: PostCategory[]
  /** The search-engine description, which cards also show as the post's summary */
  description: string | null
  /** The share image, which cards also use */
  image: ImageRef | null
  /** Where the news came from, or `null` for the site's own posts */
  source: PostSource | null
  /** True only for a cancelled event in search results, which cards mark "Cancelled" (#471) */
  cancelled?: boolean
}

/** Everything the post page shows, including its search-engine fields. */
export type PostDetail = PostSummary & {
  heroImage: ImageRef | null
  /** The photo behind the title band, one crop per screen size; `null` keeps the plain band (#1024) */
  backdrop: BandBackdrop | null
  content: RichTextValue
  /** Author names, in the order editors set them */
  authors: string[]
  /** The related posts the reader may see, in the order editors set them */
  relatedPosts: PostSummary[]
  createdAt: string
  updatedAt: string
  meta: {
    title: string | null
    description: string | null
    image: ImageRef | null
  }
}

/** A published post's address and last edit, for static pages and the sitemap. */
export type PostSitemapEntry = {
  slug: string
  updatedAt: string
}
