import type { LexicalRichTextAdapter } from '@payloadcms/richtext-lexical'
import type { Block, Field, RichTextField, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { revalidateRedirects } from '@/modules/site/cms'
import {
  EDITORIAL_BLOCKS,
  EVENT_RICH_TEXT_BLOCKS,
  RICH_TEXT_BLOCKS,
} from '@/platform/richtext/blockConfigs'
import { richTextBlocks } from '@/platform/richtext/richTextBlocks'

/**
 * Where modules meet in the CMS (docs/architecture decision 0008): checks the composed config,
 * loaded for real with no database, so a module dropped from the composition fails here.
 */

let config: SanitizedConfig

beforeAll(async () => {
  config = await (await import('@payload-config')).default
}, 60_000)

/** Every field, including those inside tabs, rows and groups. */
function allFields(fields: Field[]): Field[] {
  return fields.flatMap((field) => {
    if (field.type === 'tabs') return field.tabs.flatMap((tab) => allFields(tab.fields))
    if ('fields' in field && field.type !== 'array') {
      return [field, ...allFields(field.fields)]
    }
    return [field]
  })
}

const collection = (slug: string) => {
  const found = config.collections.find((c) => c.slug === slug)
  if (!found) throw new Error(`No ${slug} collection`)
  return found
}

/** The blocks a rich-text field's editor offers, or none. */
function editorBlocks(field: RichTextField): Block[] {
  // The sanitized field carries the Lexical adapter, which knows its features
  const editor = field.editor as LexicalRichTextAdapter
  const props = editor.editorConfig.resolvedFeatureMap.get('blocks')?.sanitizedServerFeatureProps
  return (props as { blocks?: Block[] } | undefined)?.blocks ?? []
}

/**
 * Every rich-text field, with a path such as `pages.layout.cta.richText`: inside tabs, groups,
 * rows, arrays, page-builder blocks, and the blocks a rich-text editor offers.
 */
function richTextFields(fields: Field[], path: string): { path: string; field: RichTextField }[] {
  return fields.flatMap((field) => {
    const here = 'name' in field && field.name ? `${path}.${field.name}` : path
    if (field.type === 'tabs') {
      return field.tabs.flatMap((tab) =>
        richTextFields(tab.fields, 'name' in tab && tab.name ? `${path}.${tab.name}` : path),
      )
    }
    if (field.type === 'blocks') {
      return field.blocks.flatMap((block) => richTextFields(block.fields, `${here}.${block.slug}`))
    }
    if (field.type === 'richText') {
      const inside = editorBlocks(field).flatMap((block) =>
        richTextFields(block.fields, `${here}.${block.slug}`),
      )
      return [{ path: here, field }, ...inside]
    }
    if ('fields' in field) return richTextFields(field.fields, here)
    return []
  })
}

describe('a post’s content', () => {
  it('can hold the rich-text blocks, and the post page has a renderer for each', () => {
    const content = allFields(collection('posts').fields).find(
      (field) => 'name' in field && field.name === 'content',
    )
    if (content?.type !== 'richText') throw new Error('Posts have no rich-text content')

    expect(editorBlocks(content).map((block) => block.slug)).toEqual(
      RICH_TEXT_BLOCKS.map((block) => block.slug),
    )
  })
})

describe('posts and events', () => {
  // Payload's official list features, so editors can write bulleted and numbered lists (#397)
  it.each(['posts', 'events'])('%s content offers bulleted and numbered lists', (slug) => {
    const content = allFields(collection(slug).fields).find(
      (field) => 'name' in field && field.name === 'content',
    )
    if (content?.type !== 'richText') throw new Error(`${slug} has no rich-text content`)

    const features = (content.editor as LexicalRichTextAdapter).editorConfig.resolvedFeatureMap
    expect(features.has('unorderedList')).toBe(true)
    expect(features.has('orderedList')).toBe(true)
  })

  it('offers a banner, inline images and the editorial blocks in event content, each with a renderer', () => {
    const content = allFields(collection('events').fields).find(
      (field) => 'name' in field && field.name === 'content',
    )
    if (content?.type !== 'richText') throw new Error('Events have no rich-text content')

    const slugs = editorBlocks(content).map((block) => block.slug)
    expect(slugs).toEqual(EVENT_RICH_TEXT_BLOCKS.map((block) => block.slug))
    expect(slugs).toEqual(['banner', 'mediaBlock', ...EDITORIAL_BLOCKS.map((block) => block.slug)])
    for (const slug of slugs) expect(richTextBlocks).toHaveProperty(slug)
  })

  it('offers the editorial blocks in post content too', () => {
    const slugs = RICH_TEXT_BLOCKS.map((block) => block.slug)
    for (const block of EDITORIAL_BLOCKS) expect(slugs).toContain(block.slug)
  })
})

describe('the Pages collection', () => {
  it('offers the site’s blocks, then the contact form, the events strip and top issues, in that order', () => {
    const layout = allFields(collection('pages').fields).find(
      (field) => 'name' in field && field.name === 'layout',
    )
    if (layout?.type !== 'blocks') throw new Error('Pages has no layout blocks')

    expect(layout.blocks.map((block) => block.slug)).toEqual([
      'cta',
      'content',
      'section',
      'mediaBlock',
      'mapBlock',
      'archive',
      'formBlock',
      'eventsThisWeek',
      'topIssues',
    ])
  })
})

describe('the redirects collection', () => {
  it('refreshes the site’s cached redirects when one is saved', () => {
    expect(collection('redirects').hooks.afterChange).toContain(revalidateRedirects)
  })
})

describe('the globals', () => {
  it('are the site’s header and footer, plus the job stats Payload adds for scheduled tasks', () => {
    expect(config.globals.map((global) => global.slug)).toEqual([
      'header',
      'footer',
      'payload-jobs-stats',
    ])
  })
})

describe('every other rich-text field', () => {
  // Post and event pages pass block renderers to RichText; any other field offering blocks
  // would show Payload's "unknown node" (#135).
  it('offers no blocks', () => {
    const fields = [
      ...config.collections.flatMap((c) => richTextFields(c.fields, c.slug)),
      ...config.globals.flatMap((g) => richTextFields(g.fields, g.slug)),
    ]
    // The walk reaches the nested fields too, so the check below covers them
    expect(fields.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        'events.content',
        'faq.answer',
        'pages.hero.richText',
        'pages.layout.cta.richText',
        'posts.content.banner.content',
        'forms.fields.message.message',
        'forms.confirmationMessage',
      ]),
    )

    const withBlocks = fields.filter(({ field }) => editorBlocks(field).length > 0)
    expect(withBlocks.map(({ path }) => path)).toEqual(['posts.content', 'events.content'])
  })
})
