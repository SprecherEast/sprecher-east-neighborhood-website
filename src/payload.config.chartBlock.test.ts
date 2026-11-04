import {
  convertLexicalToMarkdown,
  convertMarkdownToLexical,
  editorConfigFactory,
} from '@payloadcms/richtext-lexical'
import { extractPropsFromJSXPropsString } from '@payloadcms/richtext-lexical/shared'
import type { Payload, RichTextField } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import {
  chartFromJsx,
  chartToJsx,
  collectChartRefusals,
} from '@/platform/richtext/editorial/chartMarkdown'
import { bootPayload, NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'

/**
 * The Chart block in posts and events (#640), with the real config on in-memory SQLite: saving
 * checks the chart with the same rules as `ChartSpec` and answers with a field error, and the
 * block converts to and from Markdown through Payload's own converters.
 */

let payload: Payload
const extractProps = (tag: string) =>
  extractPropsFromJSXPropsString({
    propsString: tag.replace(/^<Chart\s+/, '').replace(/\s*\/>$/, ''),
  })
beforeAll(async () => {
  payload = (await bootPayload()).payload
}, 60_000)

const chartNode = (fields: Record<string, unknown>) => ({
  type: 'block',
  version: 2,
  format: '',
  fields: { id: 'chart-1', blockType: 'chart', ...fields },
})
const content = (...children: unknown[]) => ({
  root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children },
})
let next = 0
const savePost = (fields: Record<string, unknown>) =>
  payload.create({
    collection: 'posts',
    data: {
      title: `Budget ${++next}`,
      slug: `budget-${next}`,
      _status: 'published',
      content: content(chartNode(fields)) as never,
    },
    context: NO_REVALIDATE,
    overrideAccess: true,
  })

const BAR = {
  kind: 'bar',
  title: 'Day-to-day budget',
  summary: 'The Mayor proposes $24.8 million more.',
  unit: 'usd',
  bars: [
    { label: '2026', value: 452 },
    { label: '2027', value: 477, hatch: true },
  ],
}

describe('saving a Chart block', () => {
  it('stores a valid chart in a post', async () => {
    const post = await savePost(BAR)
    expect(JSON.stringify(post.content)).toContain('"blockType":"chart"')
  })

  it('stores a valid chart in an event', async () => {
    const event = await payload.create({
      collection: 'events',
      data: {
        title: 'Budget night',
        slug: 'budget-night',
        date: '2026-11-20T00:00:00.000Z',
        _status: 'published',
        content: content(chartNode(BAR)) as never,
      },
      context: NO_REVALIDATE,
      overrideAccess: true,
    })
    expect(JSON.stringify(event.content)).toContain('"blockType":"chart"')
  })

  it.each([
    ['an empty title', { title: ' ' }],
    ['an empty summary', { summary: '' }],
    ['a negative value', { bars: [{ label: 'A', value: -5 }] }],
    [
      'a group total that is not its parts',
      {
        kind: 'units',
        mode: 'each',
        unitNote: 'One tile is one thing.',
        groups: [{ label: 'A', total: 90, parts: [{ label: 'x', value: 5 }] }],
      },
    ],
  ])('refuses %s', async (_name, change) => {
    await expect(savePost({ ...BAR, ...change })).rejects.toThrow(
      /invalid|chart|title|summary|value|total/i,
    )
  })

  it('does not check the fields of a kind that is not chosen', async () => {
    await expect(
      savePost({ ...BAR, groups: [{ label: 'old', total: 1, parts: [] }] }),
    ).resolves.toBeDefined()
  })
})

describe('a Chart tag in Markdown', () => {
  const field = () =>
    payload.collections.posts.config.flattenedFields.find(
      (f): f is RichTextField => f.name === 'content' && f.type === 'richText',
    ) as RichTextField
  const toLexical = (markdown: string) =>
    convertMarkdownToLexical({
      editorConfig: editorConfigFactory.fromField({ field: field() }),
      markdown,
    })
  const toMarkdown = (data: ReturnType<typeof toLexical>) =>
    convertLexicalToMarkdown({
      data,
      editorConfig: editorConfigFactory.fromField({ field: field() }),
    })

  it.each(Object.entries(FIXTURES))(
    'becomes a chart block and back to the same tag for the %s sample',
    (_name, fixture) => {
      const tag = chartToJsx({ blockType: 'chart', ...chartFromJsx(fixture) } as never) as string
      const markdown = `Intro.\n\n${tag}\n\nOutro.`
      const lexical = toLexical(markdown)
      expect(JSON.stringify(lexical)).toContain('"blockType":"chart"')
      expect(toMarkdown(lexical)).toBe(markdown)
    },
  )

  it('keeps apostrophes and quotes in the words, and reads a tag written over several lines', () => {
    const bar = {
      ...FIXTURES.bars,
      title: 'The Mayor’s "big" plan, isn\'t it?',
      data: [{ key: 'a', label: 'Mayor\'s "share"', value: 3 }],
      scaleMax: undefined,
    }
    const tag = chartToJsx({ blockType: 'chart', ...chartFromJsx(bar) } as never) as string
    const again = toMarkdown(toLexical(tag))
    expect(again).toBe(tag)
    expect(chartFromJsx(extractProps(again))).toMatchObject({
      title: bar.title,
      bars: [{ label: 'Mayor\'s "share"' }],
    })
    const spread = tag.replace(' data=', '\n  data=').replace(' summary=', '\n  summary=')
    const { refusals, value } = collectChartRefusals(() =>
      toLexical(`Before.\n\n${spread}\n\nAfter.`),
    )
    expect(refusals).toEqual([])
    expect(JSON.stringify(value)).toContain('"blockType":"chart"')
  })

  it('is refused with the reason when the tag is malformed', () => {
    const { refusals } = collectChartRefusals(() => toLexical('<Chart kind="bar" title="T" />'))
    expect(refusals).toHaveLength(1)
    expect(refusals[0]).toMatch(/^Invalid <Chart>:.*summary/)
  })
})
