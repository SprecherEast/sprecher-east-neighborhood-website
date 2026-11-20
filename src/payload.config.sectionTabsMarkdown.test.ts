import { beforeAll, describe, expect, it } from 'vitest'

import { bootPayload } from '@/platform/payload/testing/inMemoryPayload'
import { markdownConverters } from '@/platform/payload/testing/markdownConverters'
import { collectTagRefusals, unreadTags } from '@/platform/richtext/editorial/editorialTag'

/**
 * `<SectionTabs>` through Payload's own Markdown converters (#1333): a tag with one `<Tab>` per
 * tab becomes a section tabs block whose panels are the tabs' content, and the block becomes the
 * same tag again; a tag that breaks the block's rules is refused with the reasons.
 */

let converters: ReturnType<typeof markdownConverters>
beforeAll(async () => {
  converters = markdownConverters((await bootPayload()).payload)
}, 60_000)

type Node = { type?: string; tag?: string; fields?: Record<string, unknown>; children?: Node[] }
type Tab = { label: string; panel: { root: Node } }

const TAGGED = [
  'Intro.',
  '',
  '<SectionTabs>',
  '<Tab label="Overview">',
  '',
  '### The short version',
  '',
  'Most of us would gain a shortcut.',
  '',
  '</Tab>',
  '<Tab label="The plan">',
  '',
  'A ramp near Milwaukee Street.',
  '',
  '- First',
  '- Second',
  '',
  '</Tab>',
  '</SectionTabs>',
  '',
  'Outro.',
].join('\n')

const blockOf = (data: ReturnType<typeof converters.toLexical>) => {
  const { root } = JSON.parse(JSON.stringify(data)) as { root: Node }
  const block = root.children?.find((child) => child.fields?.blockType === 'sectionTabs')
  return block?.fields as { tabs: Tab[] } | undefined
}

describe('a SectionTabs tag', () => {
  it('becomes a section tabs block whose tabs hold their own rich text, and back to the same tag', () => {
    const { value, refusals } = collectTagRefusals(() => converters.toLexical(TAGGED))
    expect(refusals).toEqual([])
    const block = blockOf(value)
    expect(block?.tabs.map((tab) => tab.label)).toEqual(['Overview', 'The plan'])
    const [overview, plan] = block?.tabs ?? []
    expect(overview?.panel.root.children?.map((n) => n.type)).toEqual(['heading', 'paragraph'])
    expect(overview?.panel.root.children?.[0]?.tag).toBe('h3')
    expect(plan?.panel.root.children?.map((n) => n.type)).toEqual(['paragraph', 'list'])
    expect(converters.toMarkdown(value)).toBe(TAGGED)
    expect(unreadTags(TAGGED, value, refusals)).toEqual([])
  })

  it('keeps a label with quotes, braces and an ampersand unchanged', () => {
    const markdown = TAGGED.replace('Overview', 'A &amp; &quot;B&quot;')
    const { value, refusals } = collectTagRefusals(() => converters.toLexical(markdown))
    expect(refusals).toEqual([])
    expect(blockOf(value)?.tabs[0]?.label).toBe('A & "B"')
    expect(converters.toMarkdown(value)).toBe(markdown)
  })

  it.each([
    [
      'one tab only',
      TAGGED.replace(/<Tab label="The plan">[\s\S]*?<\/Tab>\n/, ''),
      /add 2 to 4 tabs/,
    ],
    [
      'a label over the limit',
      TAGGED.replace('Overview', 'A label far too long for it'),
      /longer than 14/,
    ],
    [
      'an empty tab',
      TAGGED.replace(/(<Tab label="Overview">)[\s\S]*?(<\/Tab>)/, '$1\n\n$2'),
      /has no content/,
    ],
    [
      'text between the tabs',
      TAGGED.replace(
        '</Tab>\n<Tab label="The plan">',
        '</Tab>\nStray words\n<Tab label="The plan">',
      ),
      /nothing between them/,
    ],
    [
      'a property on the tag',
      TAGGED.replace('<SectionTabs>', '<SectionTabs size="big">'),
      /not a property/,
    ],
  ])('is refused with the reason for %s, leaving no block', (_name, markdown, reason) => {
    const { value, refusals } = collectTagRefusals(() => converters.toLexical(markdown))
    expect(refusals.join('\n')).toMatch(reason)
    expect(blockOf(value)).toBeUndefined()
  })

  it('is refused when tabs sit inside a tab', () => {
    const nested = TAGGED.replace(
      'A ramp near Milwaukee Street.',
      '<SectionTabs>\n<Tab label="x">\n\nY\n\n</Tab>\n</SectionTabs>',
    )
    const { value, refusals } = collectTagRefusals(() => converters.toLexical(nested))
    expect(refusals.length).toBeGreaterThan(0)
    expect(blockOf(value)).toBeUndefined()
  })
})
