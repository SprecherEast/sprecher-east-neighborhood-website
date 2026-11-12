import { beforeAll, describe, expect, it } from 'vitest'

import { bootPayload } from '@/platform/payload/testing/inMemoryPayload'
import { markdownConverters } from '@/platform/payload/testing/markdownConverters'
import { collectTagRefusals, unreadTags } from '@/platform/richtext/editorial/editorialTag'
import { FACT_TABS_LIMITS } from '@/platform/richtext/editorial/editorialLimits'
import { toFactTabsProps, type StoredFactTabs } from '@/platform/richtext/editorial/factTabs'
import { factTabsToJsx } from '@/platform/richtext/editorial/factTabsMarkdown'

/**
 * The `<FactTabs>` round trip through Payload's own Markdown converters (#664), with hostile text:
 * quotes, backslashes, entities, braces, `/>`, tag names and unicode in every text a tab holds.
 */

let converters: ReturnType<typeof markdownConverters>
beforeAll(async () => {
  converters = markdownConverters((await bootPayload()).payload)
}, 60_000)

const toLexical = (markdown: string) => converters.toLexical(markdown)
const toMarkdown = (data: ReturnType<typeof toLexical>) => converters.toMarkdown(data)
const blockOf = (data: ReturnType<typeof toLexical>) => converters.factTabsBlockOf(data)
const tagOf = (fields: StoredFactTabs) => factTabsToJsx(fields) as string

// A seeded generator, so a failure can be reproduced
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const PIECES = [
  '"',
  "'",
  '\\',
  '\\\\',
  '\\"',
  '&quot;',
  '&amp;',
  '&#92;',
  '&lt;',
  '&#10;',
  '{',
  '}',
  '[',
  ']',
  '/>',
  ' />',
  '<FactTabs',
  '<Chart',
  '<chart ',
  'tabs={[',
  ']}',
  '`',
  '\n',
  '  ',
  '\t',
  'é',
  'ñ',
  '✓',
  '😀',
  '日本',
  'javascript:',
  '$',
  '%',
  '<',
  '>',
  '\\u0022',
  '}}',
  '{{',
  'plain words',
]
const fuzzText = (rand: () => number, max: number) => {
  let out = ''
  const pieces = 1 + Math.floor(rand() * 6)
  for (let i = 0; i < pieces; i++) out += PIECES[Math.floor(rand() * PIECES.length)]
  // Start and end with a letter: text is stored trimmed
  return `a${out}z`.slice(0, max - 1) + 'z'
}

describe('the round trip, with hostile text', () => {
  const build = (rand: () => number): StoredFactTabs =>
    ({
      tabs: Array.from({ length: 2 + Math.floor(rand() * 3) }, (_, i) => ({
        value: fuzzText(rand, 24),
        label: fuzzText(rand, FACT_TABS_LIMITS.label),
        icon: 'money',
        certainty: 'estimate',
        linkLabel: fuzzText(rand, 60),
        linkUrl: `https://example.com/${encodeURIComponent(fuzzText(rand, 30))}`,
        heading: fuzzText(rand, FACT_TABS_LIMITS.heading),
        definition: fuzzText(rand, 240),
        panel: [
          {
            blockType: 'chart',
            kind: 'bar',
            title: fuzzText(rand, 120),
            summary: fuzzText(rand, 400),
            unit: 'count',
            bars: [{ key: `a${i}`, label: fuzzText(rand, 80), value: 3 }],
          },
          {
            blockType: 'timeline',
            entries: [
              {
                date: fuzzText(rand, 40),
                status: 'done',
                title: fuzzText(rand, 100),
                description: fuzzText(rand, 300),
              },
              { date: fuzzText(rand, 40), status: 'next', title: fuzzText(rand, 100) },
            ],
          },
        ],
      })),
    }) as unknown as StoredFactTabs

  it.each(Array.from({ length: 60 }, (_, seed) => seed))(
    'keeps every word through the real converters, twice (seed %i)',
    (seed) => {
      const fields = build(random(seed + 1))
      const tag = tagOf(fields)
      expect(tag).not.toContain('\n')
      let markdown = `Before.\n\n${tag}\n\nAfter.`
      for (let round = 0; round < 2; round++) {
        const { value, refusals } = collectTagRefusals(() => toLexical(markdown))
        expect(refusals).toEqual([])
        expect(unreadTags(markdown, value, refusals)).toEqual([])
        expect(toFactTabsProps(blockOf(value))).toEqual(toFactTabsProps(fields))
        const again = toMarkdown(value)
        expect(again).toBe(markdown)
        markdown = again
      }
    },
  )
})
