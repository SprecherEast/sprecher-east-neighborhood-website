import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

import type { Media } from '@/payload-types'

/**
 * Content shapes a module's types may hold (docs/architecture/README.md, "Layers"). Type-only:
 * they name what the CMS stores, so `RichText` and `Media` render them as they are.
 */

/** A rich-text document, as the Lexical editor saves it. */
export type RichTextValue = DefaultTypedEditorState

/** An uploaded image, as the media collection stores it. */
export type ImageRef = Media

/** A CMS link resolved to where it goes, for `Button` and `Link` (`resolveLink()` builds it). */
export type ResolvedLink = {
  href: string
  label: string
  /** Opens in a new tab */
  external: boolean
  /** The look the editor chose; the UI maps it to a `Button` variant */
  appearance: 'default' | 'outline' | 'accent'
}
