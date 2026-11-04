import { extractPropsFromJSXPropsString } from '@payloadcms/richtext-lexical'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { toFactTabsProps } from './factTabs'
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
