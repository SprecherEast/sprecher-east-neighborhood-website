import { beforeAll, describe, expect, it } from 'vitest'

import { bootPayload } from '@/platform/payload/testing/inMemoryPayload'
import { markdownConverters } from '@/platform/payload/testing/markdownConverters'
import { chartToJsx } from '@/platform/richtext/editorial/chartMarkdown'
import { collectTagRefusals, unreadTags } from '@/platform/richtext/editorial/editorialTag'
import { toFactTabsProps, type StoredFactTabs } from '@/platform/richtext/editorial/factTabs'
import { FACT_TABS_FIXTURE } from '@/platform/richtext/editorial/factTabsFixtures'
import { factTabsToJsx } from '@/platform/richtext/editorial/factTabsMarkdown'
import { present } from '@/platform/payload/testing/present'

/**
 * `<FactTabs tabs={[…]} />` through Payload's own Markdown converters (#664): the block becomes a
 * tag and the tag the same block, losslessly and stably, whatever text the tabs hold; a malformed
 * or hostile tag is refused with the reasons, and a tag Payload cannot read is noticed.
 */

let converters: ReturnType<typeof markdownConverters>
beforeAll(async () => {
  converters = markdownConverters((await bootPayload()).payload)
}, 60_000)

const toLexical = (markdown: string) => converters.toLexical(markdown)
const toMarkdown = (data: ReturnType<typeof toLexical>) => converters.toMarkdown(data)
const blockOf = (data: ReturnType<typeof toLexical>) => converters.factTabsBlockOf(data)

const tagOf = (fields: StoredFactTabs) => factTabsToJsx(fields) as string

/** One picture of a tab's panel, as the tag's JSON holds it */
const picture = (tabs: Record<string, unknown>[], tab: number, index = 0) =>
  present((present(tabs[tab]).panel as Record<string, unknown>[])[index])

describe('a FactTabs tag', () => {
  it('becomes a fact tabs block with its nested chart and timeline, and back to the same tag', () => {
    const tag = tagOf(FACT_TABS_FIXTURE)
    expect(tag).toMatch(/^<FactTabs tabs=\{\[/)
    expect(tag).not.toContain('\n')
    const markdown = `Intro.\n\n${tag}\n\nOutro.`
    const { value, refusals } = collectTagRefusals(() => toLexical(markdown))
    expect(refusals).toEqual([])
    const stored = JSON.stringify(value)
    expect(stored).toContain('"blockType":"factTabs"')
    expect(stored).toContain('"blockType":"timeline"')
    expect(stored).toContain('"blockType":"chart"')
    expect(toMarkdown(value)).toBe(markdown)
    // The same pictures: what the page would draw is unchanged by the round trip
    expect(toFactTabsProps(blockOf(value))).toEqual(toFactTabsProps(FACT_TABS_FIXTURE))
  })

  it('sits beside a chart tag in one body', () => {
    const chart = chartToJsx({
      blockType: 'chart',
      ...(FACT_TABS_FIXTURE.tabs?.[1]?.panel[0] as object),
    } as never) as string
    const markdown = `${chart}\n\n${tagOf(FACT_TABS_FIXTURE)}`
    const { value, refusals } = collectTagRefusals(() => toLexical(markdown))
    expect(refusals).toEqual([])
    expect(toMarkdown(value)).toBe(markdown)
    expect(unreadTags(markdown, value, refusals)).toEqual([])
  })

  const change = (edit: (tabs: Record<string, unknown>[]) => void) => {
    const tabs = JSON.parse(
      tagOf(FACT_TABS_FIXTURE)
        .replace(/^<FactTabs tabs=\{/, '')
        .replace(/\} \/>$/, ''),
    )
    edit(tabs)
    return `<FactTabs tabs={${JSON.stringify(tabs)}} />`
  }
  const refused = (markdown: string) => collectTagRefusals(() => toLexical(markdown)).refusals

  it.each([
    ['one tab', (t: Record<string, unknown>[]) => t.splice(1), /tabs.*(>=2|at least 2)/i],
    [
      'five tabs',
      (t: Record<string, unknown>[]) => t.push(present(t[0])),
      /tabs.*(<=4|at most 4)/i,
    ],
    [
      'a heading over 40 characters',
      (t: Record<string, unknown>[]) => {
        present(t[0]).heading = 'x'.repeat(41)
      },
      /tabs\.0\.heading/,
    ],
    [
      'a definition over 240 characters',
      (t: Record<string, unknown>[]) => {
        present(t[0]).definition = 'x'.repeat(241)
      },
      /tabs\.0\.definition/,
    ],
    [
      'an empty panel',
      (t: Record<string, unknown>[]) => {
        present(t[1]).panel = []
      },
      /tabs\.1\.panel/,
    ],
    [
      'three pictures',
      (t: Record<string, unknown>[]) => {
        present(t[0]).panel = [
          ...(present(t[0]).panel as unknown[]),
          (present(t[0]).panel as unknown[])[0],
        ]
      },
      /tabs\.0\.panel/,
    ],
    [
      'an unknown icon',
      (t: Record<string, unknown>[]) => {
        present(t[0]).icon = 'rocket'
      },
      /tabs\.0\.icon/,
    ],
    [
      'a stray property',
      (t: Record<string, unknown>[]) => {
        present(t[0]).colour = 'red'
      },
      /colour/i,
    ],
    [
      'a chart with no title',
      (t: Record<string, unknown>[]) => {
        delete picture(t, 0).title
      },
      /tabs\.0\.panel\.0\.title/,
    ],
    [
      'a chart with an unknown property',
      (t: Record<string, unknown>[]) => {
        picture(t, 0).colour = 'red'
      },
      /colour is not a property/,
    ],
    [
      'a picture that is neither',
      (t: Record<string, unknown>[]) => {
        ;(present(t[0]).panel as unknown[])[0] = { block: 'video' }
      },
      /tabs\.0\.panel\.0/,
    ],
    [
      'a one-milestone timeline',
      (t: Record<string, unknown>[]) => {
        picture(t, 3).entries = [{ date: 'x', status: 'done', title: 'y' }]
      },
      /tabs\.3\.panel\.0\.entries/,
    ],
    [
      'two "Next up" milestones',
      (t: Record<string, unknown>[]) => {
        const e = picture(t, 3).entries as {
          status: string
        }[]
        present(e[0]).status = 'next'
      },
      /Next up/,
    ],
  ])('is refused, with the reason, for %s', (_name, edit, reason) => {
    const reasons = refused(change(edit))
    expect(reasons).toHaveLength(1)
    expect(reasons[0]).toMatch(/^Invalid <FactTabs>:/)
    expect(reasons[0]).toMatch(reason)
  })

  it('is refused for a prop other than tabs', () => {
    const reasons = refused('<FactTabs tabs={[]} colour="red" />')
    expect(reasons[0]).toMatch(/colour is not a property/)
  })

  const HOSTILE = [
    'javascript:alert(1)',
    ' JaVaScRiPt:alert(1)',
    '//evil.example.com',
    '/\\evil.example.com',
    'data:text/html,<b>x</b>',
    'ftp://example.com',
    'https://exa mple.com',
  ]
  it.each(HOSTILE)('refuses the address %j in a tab, a milestone and a chart source', (href) => {
    const places: [string, (t: Record<string, unknown>[]) => void][] = [
      [
        'tab',
        (t) => {
          present(t[0]).link = { label: 'x', href }
        },
      ],
      [
        'milestone',
        (t) => {
          present((picture(t, 3).entries as Record<string, unknown>[])[0]).link = {
            label: 'x',
            href,
          }
        },
      ],
      [
        'chart source',
        (t) => {
          picture(t, 0).sources = [{ label: 'x', href }]
        },
      ],
    ]
    for (const [, edit] of places) {
      const reasons = refused(change(edit))
      expect(reasons).toHaveLength(1)
      expect(reasons[0]).toMatch(/site path|address|http/i)
    }
  })

  it.each([
    ['a tag that never closes', (t: string) => t.slice(0, -3)],
    [
      'a raw quote in a title',
      (t: string) => t.replace('"Day-to-day money, proposed"', '"Day"to-day"'),
    ],
    [
      'a raw brace in a label',
      (t: string) => t.replace('Big-project money, proposed', 'Big } project'),
    ],
  ])('is noticed, and not silently dropped, when Payload cannot read it: %s', (_name, damage) => {
    const markdown = `Intro.\n\n${damage(tagOf(FACT_TABS_FIXTURE))}\n\nOutro.`
    const { value, refusals } = collectTagRefusals(() => toLexical(markdown))
    const unread = unreadTags(markdown, value, refusals)
    // Either Payload could not find the end (unread), or the damaged text was refused
    expect(unread.length > 0 || refusals.length > 0).toBe(true)
    if (unread.length > 0) expect(unread[0]).toMatchObject({ name: 'FactTabs', count: 1 })
  })

  it('does not count a tag that became a block or a refusal as unread', () => {
    const bad = '<FactTabs tabs={[]} />'
    const markdown = `${tagOf(FACT_TABS_FIXTURE)}\n\n${bad}`
    const { value, refusals } = collectTagRefusals(() => toLexical(markdown))
    expect(refusals).toHaveLength(1)
    expect(unreadTags(markdown, value, refusals)).toEqual([])
  })

  it('is left out of the Markdown when it could not be read back', () => {
    expect(factTabsToJsx({ tabs: [] })).toBe(false)
    const one = { tabs: FACT_TABS_FIXTURE.tabs?.slice(0, 1) } as StoredFactTabs
    expect(factTabsToJsx(one)).toBe(false)
  })
})
