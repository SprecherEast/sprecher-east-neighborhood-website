import { extractPropsFromJSXPropsString } from '@payloadcms/richtext-lexical'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { FACT_TABS_LIMITS } from './editorialLimits'
import { toFactTabsProps, type StoredFactTabs } from './factTabs'
import { FACT_TABS_FIXTURE } from './factTabsFixtures'
import { factTabsToJsx, importFactTabsTag } from './factTabsMarkdown'
import { present } from '@/platform/payload/testing/present'

const propsOf = (tag: string): Record<string, unknown> =>
  extractPropsFromJSXPropsString({
    propsString: tag.replace(/^<FactTabs\s+/, '').replace(/\s*\/>$/, ''),
  })

describe('factTabsToJsx and importFactTabsTag', () => {
  it('write one tag on one line that reads back as the same tabs', () => {
    const tag = factTabsToJsx(FACT_TABS_FIXTURE) as string
    expect(tag).not.toContain('\n')
    const back = importFactTabsTag(propsOf(tag))
    expect(back).not.toBe(false)
    expect(toFactTabsProps(back as never)).toEqual(toFactTabsProps(FACT_TABS_FIXTURE))
    expect(factTabsToJsx(back as never)).toBe(tag)
  })

  it("keeps a tab's one-line detail through the tag", () => {
    const withDetail = {
      tabs: FACT_TABS_FIXTURE.tabs?.map((t, i) => (i === 0 ? { ...t, detail: 'Per year' } : t)),
    } as StoredFactTabs
    const back = importFactTabsTag(propsOf(factTabsToJsx(withDetail) as string)) as StoredFactTabs
    expect(back.tabs?.[0]?.detail).toBe('Per year')
    expect(back.tabs?.[1]?.detail).toBeUndefined()
  })

  it("keeps a panel chart's palette through the tag", () => {
    const [first, ...rest] = FACT_TABS_FIXTURE.tabs ?? []
    const warm = {
      tabs: [
        { ...first, panel: first?.panel?.map((b) => ({ ...b, palette: 'warm' as const })) },
        ...rest,
      ],
    } as StoredFactTabs
    const tag = factTabsToJsx(warm) as string
    const back = importFactTabsTag(propsOf(tag)) as StoredFactTabs
    expect(back.tabs?.[0]?.panel?.every((b) => 'palette' in b && b.palette === 'warm')).toBe(true)
    expect(factTabsToJsx(back as never)).toBe(tag)
  })

  it('keeps a whole tax bill, its rates left empty where a body has not set one, through the tag (#1018)', () => {
    const [first, ...rest] = FACT_TABS_FIXTURE.tabs ?? []
    const bill = {
      blockType: 'billShare' as const,
      intro: 'Based on the City’s average home.',
      years: [
        {
          year: 2026,
          label: '2026 rates',
          averageHome: 481300,
          schools: 8.6814,
          county: 2.3564,
          matc: 0.6153,
          city: 7.0139,
          linkLabel: 'City tax detail',
          linkUrl: 'https://example.org/tax',
        },
        { year: 2027, label: '2027 rates', note: 'proposed', averageHome: 500300, city: 6.93 },
      ],
    }
    const stored = {
      tabs: [{ ...first, panel: [...(first?.panel ?? []), bill] }, ...rest],
    } as unknown as StoredFactTabs
    const tag = factTabsToJsx(stored) as string
    const back = importFactTabsTag(propsOf(tag)) as StoredFactTabs
    expect(toFactTabsProps(back as never)).toEqual(toFactTabsProps(stored))
    expect(factTabsToJsx(back as never)).toBe(tag)
    const shown = toFactTabsProps(back as never).tabs[0]?.panel.at(-1)
    expect(shown).toMatchObject({ kind: 'billShare' })
  })

  it('refuses a whole tax bill with a rate that is not a number above zero', () => {
    const tabs = (FACT_TABS_FIXTURE.tabs ?? []).map((t) => ({
      value: t.value,
      label: t.label,
      icon: t.icon,
      certainty: t.certainty,
      heading: t.heading,
      definition: t.definition,
      panel: [
        {
          block: 'billShare',
          intro: 'x',
          years: [{ year: 2026, label: 'y', averageHome: 1, city: -1 }],
        },
      ],
    }))
    expect(() => importFactTabsTag({ tabs })).toThrow(/^Invalid <FactTabs>:/)
  })

  it('refuses a second whole tax bill in one panel', () => {
    const bill = {
      block: 'billShare',
      intro: 'x',
      years: [{ year: 2026, label: 'y', averageHome: 1, city: 7 }],
    }
    const tabs = (FACT_TABS_FIXTURE.tabs ?? []).map((t) => ({
      value: t.value,
      label: t.label,
      icon: t.icon,
      certainty: t.certainty,
      heading: t.heading,
      definition: t.definition,
      panel: [bill, bill],
    }))
    expect(() => importFactTabsTag({ tabs })).toThrow(/once per tab/)
  })

  it('throws the reasons outside a conversion, starting "Invalid <FactTabs>:"', () => {
    expect(() => importFactTabsTag({ tabs: [] })).toThrow(/^Invalid <FactTabs>: tabs/)
    expect(() => importFactTabsTag({})).toThrow(/Invalid <FactTabs>/)
  })

  it('lists every reason at once', () => {
    const [good] = JSON.parse(
      (factTabsToJsx(FACT_TABS_FIXTURE) as string)
        .replace(/^<FactTabs tabs=\{/, '')
        .replace(/\} \/>$/, ''),
    )
    const bad = { ...good, heading: '', icon: 'rocket' }
    expect(() => importFactTabsTag({ tabs: [bad, good] })).toThrow(/heading.*icon|icon.*heading/s)
  })
})

describe('factTabsToJsx leaves out a block its own tag could not be read back from', () => {
  const [first, second] = FACT_TABS_FIXTURE.tabs ?? []
  const two = (change: Record<string, unknown>) =>
    ({ tabs: [{ ...first, ...change }, second] }) as unknown as StoredFactTabs

  it('writes two valid tabs', () => {
    expect(factTabsToJsx(two({}))).toMatch(/^<FactTabs /)
  })

  it.each([
    ['an empty definition', { definition: '' }],
    ['a heading over its limit', { heading: 'x'.repeat(FACT_TABS_LIMITS.heading + 1) }],
    [
      'a label too long for one line on a button',
      { label: 'x'.repeat(FACT_TABS_LIMITS.label + 1) },
    ],
    [
      'a one-milestone timeline',
      {
        panel: [
          { blockType: 'timeline', entries: [{ date: 'Now', status: 'next', title: 'Start' }] },
        ],
      },
    ],
    [
      'two "Next up" milestones',
      {
        panel: [
          {
            blockType: 'timeline',
            entries: [
              { date: 'a', status: 'next', title: 'A' },
              { date: 'b', status: 'next', title: 'B' },
            ],
          },
        ],
      },
    ],
    ['no picture that can be drawn', { panel: [{ blockType: 'chart', kind: 'bar' }] }],
  ])('for %s', (_name, change) => {
    expect(factTabsToJsx(two(change))).toBe(false)
  })
})

describe('the example in the draft prompt', () => {
  const prompt = readFileSync(
    path.resolve(__dirname, '../../../../intelligence/prompts/draft.md'),
    'utf8',
  )
  const tags = prompt.match(/<FactTabs tabs=\{\[\{[^`]*\/>/g) ?? []

  it('has one example, and it is a valid block in the canonical form', () => {
    expect(tags).toHaveLength(1)
    const fields = importFactTabsTag(propsOf(present(tags[0])))
    expect(fields).not.toBe(false)
    expect(factTabsToJsx(fields as never)).toBe(tags[0])
  })
})

describe('a fact tab chart with enlarge off (#686)', () => {
  const tabs = () =>
    JSON.parse(
      (factTabsToJsx(FACT_TABS_FIXTURE) as string)
        .replace(/^<FactTabs tabs=\{/, '')
        .replace(/\} \/>$/, ''),
    ) as { panel: Record<string, unknown>[] }[]

  it('writes it in the picture, reads it back and shows it in the props', () => {
    const stored = {
      tabs: FACT_TABS_FIXTURE.tabs?.map((t, i) =>
        i === 0
          ? { ...t, panel: t.panel?.map((p, j) => (j === 0 ? { ...p, enlarge: false } : p)) }
          : t,
      ),
    } as StoredFactTabs
    const tag = factTabsToJsx(stored) as string
    expect(tag.match(/"enlarge":"false"/g)).toHaveLength(1)
    const back = importFactTabsTag(propsOf(tag)) as StoredFactTabs
    const [first, second] = toFactTabsProps(back).tabs[0]?.panel ?? []
    expect(first).toMatchObject({ kind: 'chart', enlarge: false })
    expect(second).toMatchObject({ kind: 'chart', enlarge: true })
    expect(factTabsToJsx(back)).toBe(tag)
  })

  it('accepts a JSON boolean and refuses another value with its place', () => {
    const [good] = tabs()
    const withValue = (value: unknown) => ({
      tabs: [{ ...good, panel: [{ ...good?.panel[0], enlarge: value }] }, ...tabs().slice(1)],
    })
    expect(() => importFactTabsTag(withValue(false))).not.toThrow()
    expect(() => importFactTabsTag(withValue('false'))).not.toThrow()
    expect(() => importFactTabsTag(withValue('later'))).toThrow(/panel.*enlarge/s)
  })
})
