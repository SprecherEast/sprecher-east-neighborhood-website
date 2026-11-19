import type { Block } from 'payload'
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
  OrderedListFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'

type HeadingSizes = NonNullable<
  NonNullable<Parameters<typeof HeadingFeature>[0]>['enabledHeadingSizes']
>

/** The sizes where the field holds its own title: a hero, a banner, an intro. */
export const TITLE_HEADINGS: HeadingSizes = ['h1', 'h2', 'h3', 'h4']
/** The sizes under a page's own title (h1), for the body text of a column. */
export const BODY_HEADINGS: HeadingSizes = ['h2', 'h3', 'h4']

/**
 * The editor for a short rich text field: Payload's standard features, headings, and the fixed and
 * inline toolbars. The one place that list is written; fields differ only in the sizes they allow.
 */
export const headingsEditor = (headings: HeadingSizes = TITLE_HEADINGS) =>
  lexicalEditor({
    features: ({ rootFeatures }) => [
      ...rootFeatures,
      HeadingFeature({ enabledHeadingSizes: headings }),
      FixedToolbarFeature(),
      InlineToolbarFeature(),
    ],
  })

/**
 * The editor for an article's body (a post or an event): the headings editor plus the blocks that
 * module allows inside the text, a horizontal rule and lists.
 */
export const articleEditor = (blocks: Block[], headings: HeadingSizes) =>
  lexicalEditor({
    features: ({ rootFeatures }) => [
      ...rootFeatures,
      HeadingFeature({ enabledHeadingSizes: headings }),
      BlocksFeature({ blocks }),
      FixedToolbarFeature(),
      InlineToolbarFeature(),
      HorizontalRuleFeature(),
      UnorderedListFeature(),
      OrderedListFeature(),
    ],
  })
