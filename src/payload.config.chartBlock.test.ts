import {
  convertLexicalToMarkdown,
  convertMarkdownToLexical,
  editorConfigFactory,
} from '@payloadcms/richtext-lexical'
import type { Payload, RichTextField } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec } from '@/platform/lib/chart/spec'
import { fromChartSpec } from '@/platform/richtext/editorial/chart'
import { chartFromJsx, chartToJsx } from '@/platform/richtext/editorial/chartMarkdown'
import { collectTagRefusals, unreadTags } from '@/platform/richtext/editorial/editorialTag'
import { bootPayload, NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'

/**
 * The Chart block in posts and events (#640), with the real config on in-memory SQLite: saving
 * checks the chart with the same rules as `ChartSpec` and answers with a field error, and the
 * block converts to and from Markdown through Payload's own converters.
 */

let payload: Payload
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

  it.each(Object.entries(FIXTURES))(
    'stores the %s fixture in a post and in an event',
    async (name, spec) => {
      const fields = fromChartSpec(parseChartSpec(spec))
      const post = await savePost(fields)
      expect(JSON.stringify(post.content)).toContain('"blockType":"chart"')
      const event = await payload.create({
        collection: 'events',
        data: {
          title: `Night ${name}`,
          slug: `night-${name}`,
          date: '2026-11-20T00:00:00.000Z',
          _status: 'published',
          content: content(chartNode(fields)) as never,
        },
        context: NO_REVALIDATE,
        overrideAccess: true,
      })
      expect(JSON.stringify(event.content)).toContain('"blockType":"chart"')
    },
  )

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

  it.each([
    [
      'an empty title with bars sent as a count',
      { kind: 'bar', title: '', summary: '', unit: 'usd', bars: 3 },
    ],
    [
      'a wrong total with sources sent as a count',
      {
        kind: 'units',
        title: 'T',
        summary: 'S',
        unit: 'usd',
        mode: 'each',
        unitNote: 'x',
        sources: 1,
        groups: [{ label: 'A', total: 90, parts: [{ label: 'x', value: 5 }] }],
      },
    ],
    ['a too-short scale with a leftover count', { ...BAR, scaleMax: 1, series: 2 }],
  ])('refuses %s (a count is not rows on a real save)', async (_name, fields) => {
    await expect(savePost(fields)).rejects.toThrow(/invalid|chart|title|summary|value|total|scale/i)
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

  // Text that Payload's tag reader trips on: quotes, braces, brackets, backslashes, `/>`, entities
  const NASTY = [
    'Mayor’s "big" plan, isn\'t it?',
    'a } b { c ] d [ e',
    'back\\slash',
    'ends with a backslash\\',
    'one " quote',
    '12" pipe',
    'Café ✓ 😀 and  two  spaces',
    'a /> b <x>',
    'see <Chart x and <chart',
    'a literal &quot; and &amp; here',
    'line one\nline two',
  ]
  const dataOf = (text: string, where: 'title' | 'label') => ({
    ...FIXTURES.bars,
    scaleMax: undefined,
    ...(where === 'title' ? { title: text } : {}),
    data: [{ key: 'a', label: where === 'label' ? text : 'A', value: 3 }],
  })

  it.each(NASTY.flatMap((text) => [[text, 'title'] as const, [text, 'label'] as const]))(
    'keeps the words exactly through the real converters, twice: %j in the %s',
    (text, where) => {
      const tag = chartToJsx({
        blockType: 'chart',
        ...fromChartSpec(parseChartSpec(dataOf(text, where))),
      } as never) as string
      expect(tag).not.toContain('\n')
      for (let round = 0; round < 2; round++) {
        const { value, refusals } = collectTagRefusals(() => toLexical(tag))
        expect(refusals).toEqual([])
        expect(toMarkdown(value)).toBe(tag)
        const block = JSON.parse(JSON.stringify(value)).root.children[0].fields
        expect(where === 'title' ? block.title : block.bars[0].label).toBe(text)
      }
    },
  )

  it('reads a tag written over several lines', () => {
    const tag = chartToJsx({
      blockType: 'chart',
      ...chartFromJsx(FIXTURES.bars),
    } as never) as string
    const spread = tag.replace(' data=', '\n  data=').replace(' summary=', '\n  summary=')
    const { refusals, value } = collectTagRefusals(() =>
      toLexical(`Before.\n\n${spread}\n\nAfter.`),
    )
    expect(refusals).toEqual([])
    expect(JSON.stringify(value)).toContain('"blockType":"chart"')
  })

  it('is refused with the reason when the tag is malformed', () => {
    const { refusals } = collectTagRefusals(() => toLexical('<Chart kind="bar" title="T" />'))
    expect(refusals).toHaveLength(1)
    expect(refusals[0]).toMatch(/^Invalid <Chart>:.*summary/)
  })

  it.each([
    [
      'an escaped quote in a label',
      '<Chart kind="bar" title="T" summary="S." unit="count" data={[{"key":"a","label":"12\\" pipe","value":4}]} />',
    ],
    [
      'a tag with no closing />',
      '<Chart kind="bar" title="T" summary="S." unit="count" data={[{"key":"a","label":"A","value":4}]}',
    ],
  ])('notices a tag Payload could not read (%s), which leaves the body empty', (_name, tag) => {
    const markdown = `Intro.\n\n${tag}\n\nOutro.`
    const { value, refusals } = collectTagRefusals(() => toLexical(markdown))
    expect(unreadTags(markdown, value, refusals)).toEqual([{ name: 'Chart', count: 1 }])
  })

  it('counts nothing unread when every tag became a block or a refusal', () => {
    const tag = chartToJsx({
      blockType: 'chart',
      ...chartFromJsx(FIXTURES.bars),
    } as never) as string
    const bad =
      '<Chart kind="bar" title="T" unit="usd" data={[{"key":"a","label":"A","value":1}]} />'
    const markdown = `${tag}\n\n${bad}\n\nOutro.`
    const { value, refusals } = collectTagRefusals(() => toLexical(markdown))
    expect(refusals).toHaveLength(1)
    expect(unreadTags(markdown, value, refusals)).toEqual([])
  })
})
