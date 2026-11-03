import type {
  DefaultNodeTypes,
  SerializedAutoLinkNode,
  SerializedBlockNode,
  SerializedHeadingNode,
  SerializedLinkNode,
} from '@payloadcms/richtext-lexical'
import type {
  JSXConverter,
  JSXConverters,
  JSXConvertersFunction,
} from '@payloadcms/richtext-lexical/react'
import { RichText as ConvertRichText } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import { cn } from '@/platform/lib/cn'
import type { RichTextValue } from '@/platform/lib'
import { documentHref } from '@/platform/payload/documentHref'
import { Link } from '@/platform/ui/Link'
import { SECTION_SCROLL_MARGIN } from '@/platform/ui/onThisPage'
import type {
  BannerBlock,
  DiagramKeyBlock,
  KeyFactsBlock,
  MediaBlock,
  OutcomeForkBlock,
  StepsBlock,
  TimelineBlock,
} from '@/payload-types'

import type { CodeBlockProps } from './CodeBlock'
import { anchorsByNode } from './headingAnchors'

/** A node for one of the blocks an editor can put inside rich text (`RICH_TEXT_BLOCKS`) */
export type RichTextBlockNode = SerializedBlockNode<
  | BannerBlock
  | CodeBlockProps
  | MediaBlock
  | TimelineBlock
  | StepsBlock
  | KeyFactsBlock
  | OutcomeForkBlock
  | DiagramKeyBlock
>

type NodeTypes = DefaultNodeTypes | RichTextBlockNode

/**
 * Renderers for the blocks a rich-text field may hold, by block type. The caller passes them in
 * (post and event pages pass `richTextBlocks`), so this file imports no block, and a block can render
 * rich text of its own without an import cycle (#135).
 */
export type RichTextBlocks = NonNullable<JSXConverters<NodeTypes>['blocks']>

/**
 * Where a rich-text link goes: a site address for a page or post, or the URL the editor typed.
 * Null when there is nowhere to go, such as a link to a document that was deleted (#215).
 */
export function richTextLinkHref(fields: SerializedLinkNode['fields']): string | null {
  if (fields.linkType !== 'internal') return fields.url || null
  // A deleted document leaves the value null; an unpopulated one leaves its ID
  const value = fields.doc?.value
  const slug =
    value && typeof value === 'object' && typeof value.slug === 'string' ? value.slug : ''
  return fields.doc && slug ? documentHref(fields.doc.relationTo, slug) : null
}

// Links are the shared `Link` (inline), with its focus ring and new-tab note; one with nowhere
// to go is plain text rather than a link to the home page
const renderLink = (
  node: SerializedLinkNode | SerializedAutoLinkNode,
  children: React.ReactNode,
): React.ReactNode => {
  const href = richTextLinkHref(node.fields as SerializedLinkNode['fields'])
  if (!href) return children
  return (
    <Link href={href} external={Boolean(node.fields.newTab)}>
      {children}
    </Link>
  )
}

const linkConverters: {
  link: JSXConverter<SerializedLinkNode>
  autolink: JSXConverter<SerializedAutoLinkNode>
} = {
  link: ({ node, nodesToJSX }) => renderLink(node, nodesToJSX({ nodes: node.children })),
  autolink: ({ node, nodesToJSX }) => renderLink(node, nodesToJSX({ nodes: node.children })),
}

const withBlocks =
  (blocks: RichTextBlocks): JSXConvertersFunction<NodeTypes> =>
  ({ defaultConverters }) => ({
    ...defaultConverters,
    ...linkConverters,
    blocks,
  })

const NO_BLOCKS = withBlocks({})

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

// An h2 or h3 gets the id `headingAnchors` gives it, and room above it so a jump to it
// (`#whats-next`) lands clear of the sticky site header (#573). Other headings stay as Payload
// draws them.
const withHeadingIds =
  (
    converters: JSXConvertersFunction<NodeTypes>,
    anchors: ReturnType<typeof anchorsByNode>,
  ): JSXConvertersFunction<NodeTypes> =>
  (args) => {
    const base = converters(args)
    const heading: JSXConverter<SerializedHeadingNode> = ({ node, nodesToJSX }) => {
      const anchor = anchors.get(node)
      const Tag = (HEADING_TAGS.has(node.tag) ? node.tag : 'h1') as 'h1' | 'h2' | 'h3' | 'h4'
      return (
        <Tag id={anchor?.id} className={anchor ? SECTION_SCROLL_MARGIN : undefined}>
          {nodesToJSX({ nodes: node.children })}
        </Tag>
      )
    }
    return { ...base, heading }
  }

type Props = {
  data: RichTextValue
  /**
   * Renderers for the blocks this field may hold. Pass them for any field whose editor has a
   * blocks feature: Payload draws a block with no renderer as "unknown node". Today post and
   * event content have blocks (`payload.config.test.ts` checks every rich-text field).
   */
  blocks?: RichTextBlocks
  enableGutter?: boolean
  enableProse?: boolean
} & React.HTMLAttributes<HTMLDivElement>

/** Rich text as the editor saved it, with links to pages and posts resolved to site addresses. */
export function RichText(props: Props) {
  const { blocks, className, enableProse = true, enableGutter = true, ...rest } = props
  return (
    <ConvertRichText
      converters={withHeadingIds(
        blocks ? withBlocks(blocks) : NO_BLOCKS,
        anchorsByNode(props.data),
      )}
      className={cn(
        'payload-richtext',
        {
          container: enableGutter,
          'mx-auto prose md:prose-md': enableProse,
          // Without a gutter the parent sets the width: full width, no prose 65ch cap
          // (otherwise `mx-auto` shrinks and centres the text inside flex cards). A max-w-*
          // passed in className still wins, because tailwind-merge drops this max-w-none.
          'w-full max-w-none': !enableGutter,
        },
        className,
      )}
      {...rest}
    />
  )
}
