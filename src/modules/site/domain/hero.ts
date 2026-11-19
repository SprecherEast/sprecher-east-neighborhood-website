import type { ImageRef, ResolvedLink, RichTextValue } from '@/platform/lib'

/*
 * The plain props of a page's hero (decision 0013). `toPageHeroProps` in `data/mappers.ts` builds
 * them from the stored hero; `PageHero` in `ui/` draws them.
 */

/**
 * A page's hero, in the look the editor chose:
 * - `high`: a photo behind the page's title, its text and its buttons (home)
 * - `medium`: the text and links above a wide image with its caption
 * - `low`: the title and text only, at a readable width
 *
 * The title is the first heading of `body`. The low hero has never drawn links or an image, so it
 * carries neither.
 */
export type PageHeroProps =
  | {
      variant: 'high' | 'medium'
      body?: RichTextValue
      image?: ImageRef
      links: ResolvedLink[]
    }
  | { variant: 'low'; body: RichTextValue }
