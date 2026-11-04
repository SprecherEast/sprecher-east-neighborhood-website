import { extractPropsFromJSXPropsString } from '@payloadcms/richtext-lexical'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

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
    ['a heading over its limit', { heading: 'x'.repeat(41) }],
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
