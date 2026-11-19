import type { Block } from 'payload'
import { describe, expect, it, vi } from 'vitest'

// The editor builders only describe a feature list, so the test records it
vi.mock('@payloadcms/richtext-lexical', () => {
  const feature = (name: string) => (options?: object) => ({ name, ...options })
  return {
    lexicalEditor: (options: { features: (args: { rootFeatures: unknown[] }) => unknown[] }) =>
      options.features({ rootFeatures: [{ name: 'root' }] }),
    HeadingFeature: feature('heading'),
    BlocksFeature: feature('blocks'),
    FixedToolbarFeature: feature('fixedToolbar'),
    InlineToolbarFeature: feature('inlineToolbar'),
    HorizontalRuleFeature: feature('horizontalRule'),
    UnorderedListFeature: feature('unorderedList'),
    OrderedListFeature: feature('orderedList'),
  }
})

import { articleEditor, BODY_HEADINGS, headingsEditor, TITLE_HEADINGS } from './headingsEditor'

const names = (features: unknown) => (features as { name: string }[]).map((f) => f.name)

describe('headingsEditor', () => {
  it('adds headings and both toolbars to the standard features, h1 to h4 by default', () => {
    const features = headingsEditor() as unknown as {
      name: string
      enabledHeadingSizes?: string[]
    }[]

    expect(names(features)).toEqual(['root', 'heading', 'fixedToolbar', 'inlineToolbar'])
    expect(features[1]?.enabledHeadingSizes).toEqual([...TITLE_HEADINGS])
    expect(TITLE_HEADINGS).toEqual(['h1', 'h2', 'h3', 'h4'])
  })

  it('takes the heading sizes a field allows', () => {
    const features = headingsEditor(BODY_HEADINGS) as unknown as {
      enabledHeadingSizes?: string[]
    }[]

    expect(features[1]?.enabledHeadingSizes).toEqual(['h2', 'h3', 'h4'])
  })
})

describe('articleEditor', () => {
  const blocks = [{ slug: 'banner', fields: [] }] as Block[]

  it('is the headings editor plus the field’s blocks, a rule and lists', () => {
    const features = articleEditor(blocks, TITLE_HEADINGS) as unknown as {
      name: string
      blocks?: Block[]
    }[]

    expect(names(features)).toEqual([
      'root',
      'heading',
      'blocks',
      'fixedToolbar',
      'inlineToolbar',
      'horizontalRule',
      'unorderedList',
      'orderedList',
    ])
    expect(features[2]?.blocks).toBe(blocks)
  })
})
