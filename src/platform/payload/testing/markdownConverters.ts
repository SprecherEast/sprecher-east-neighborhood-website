import {
  convertLexicalToMarkdown,
  convertMarkdownToLexical,
  editorConfigFactory,
} from '@payloadcms/richtext-lexical'
import type { Payload, RichTextField } from 'payload'

import type { StoredFactTabs } from '@/platform/richtext/editorial/factTabs'

/** Payload's own Markdown converters, with the editor config of the posts' `content` field */
export function markdownConverters(payload: Payload) {
  const editorConfig = () =>
    editorConfigFactory.fromField({
      field: payload.collections.posts.config.flattenedFields.find(
        (f): f is RichTextField => f.name === 'content' && f.type === 'richText',
      ) as RichTextField,
    })
  const toLexical = (markdown: string) =>
    convertMarkdownToLexical({ editorConfig: editorConfig(), markdown })
  const toMarkdown = (data: ReturnType<typeof toLexical>) =>
    convertLexicalToMarkdown({ data, editorConfig: editorConfig() })
  /** The first fact tabs block of converted Markdown, as stored (what a save would keep) */
  const factTabsBlockOf = (lexical: ReturnType<typeof toLexical>) => {
    const { root } = JSON.parse(JSON.stringify(lexical)) as {
      root: { children: { fields?: StoredFactTabs & { blockType?: string } }[] }
    }
    const block = root.children.find((child) => child.fields?.blockType === 'factTabs')
    if (!block?.fields) throw new Error('No fact tabs block in the converted Markdown')
    return block.fields
  }
  return { toLexical, toMarkdown, factTabsBlockOf }
}
