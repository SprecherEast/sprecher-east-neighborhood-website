import type { Block, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { EDITORIAL_BLOCKS, EVENT_RICH_TEXT_BLOCKS, RICH_TEXT_BLOCKS } from '../blockConfigs'

import { FACT_TABS_LIMITS, KEY_FACT_LIMITS, TIMELINE_LIMITS } from './editorialLimits'
import { FactTabsBlockConfig } from './factTabsBlockConfig'
import { keyFactFields, KeyFactsBlockConfig } from './keyFactsBlockConfig'

/** Every field, including those in rows, arrays and the blocks of a blocks field */
const fieldsOf = (fields: Field[]): Field[] =>
  fields.flatMap((f) => {
    if (f.type === 'row') return fieldsOf(f.fields)
    if (f.type === 'blocks') return [f, ...f.blocks.flatMap((b) => fieldsOf(b.fields))]
    return 'fields' in f ? [f, ...fieldsOf(f.fields)] : [f]
  })
const all = fieldsOf(FactTabsBlockConfig.fields)
const byName = (name: string) =>
  all.find((f) => 'name' in f && f.name === name) as Field & Record<string, unknown>

describe('FactTabsBlockConfig', () => {
  it('gives every array and blocks field an admin config: Payload reads admin.initCollapsed of each one', () => {
    const lists = all.filter((f) => f.type === 'array' || f.type === 'blocks')
    // tabs, panel, and the chart's and timeline's own arrays inside the panel
    expect(lists.length).toBeGreaterThan(6)
    for (const list of lists) {
      expect('admin' in list && list.admin, `${'name' in list ? list.name : '?'}`).toBeTruthy()
    }
  })

  it('is offered in posts and events, after the other visual blocks', () => {
    const slugs = (blocks: Block[]) => blocks.map((b) => b.slug)
    expect(slugs(EDITORIAL_BLOCKS).at(-1)).toBe('factTabs')
    expect(slugs(RICH_TEXT_BLOCKS)).toContain('factTabs')
    expect(slugs(EVENT_RICH_TEXT_BLOCKS)).toContain('factTabs')
    expect(FactTabsBlockConfig.interfaceName).toBe('FactTabsBlock')
  })

  it('takes two to four tabs and one to two pictures from the limits', () => {
    expect(byName('tabs')).toMatchObject({
      minRows: FACT_TABS_LIMITS.minTabs,
      maxRows: FACT_TABS_LIMITS.maxTabs,
      required: true,
    })
    expect(byName('panel')).toMatchObject({
      minRows: FACT_TABS_LIMITS.minPanelBlocks,
      maxRows: FACT_TABS_LIMITS.maxPanelBlocks,
      required: true,
    })
    expect([FACT_TABS_LIMITS.minTabs, FACT_TABS_LIMITS.maxTabs]).toEqual([2, 4])
  })

  it('lets a tab heading run to 48 characters, enough for a question about the reader’s property taxes (#1118)', () => {
    expect(byName('heading')).toMatchObject({ maxLength: 48 })
    expect(FACT_TABS_LIMITS.heading).toBe(48)
    expect('What does this mean for your property taxes?'.length).toBeLessThanOrEqual(48)
  })

  it('offers only a chart, a timeline and a whole tax bill in a panel, as the blocks themselves', () => {
    const panel = byName('panel') as unknown as { blocks: Block[] }
    expect(panel.blocks.map((b) => b.slug)).toEqual(['chart', 'timeline', 'billShare'])
  })

  it('refuses a second whole tax bill in one panel, which would be hidden', () => {
    const check = byName('panel').validate as unknown as (v: unknown, a: object) => true | string
    const bill = { blockType: 'billShare' }
    expect(check([bill, { blockType: 'chart' }], {})).toBe(true)
    expect(check([bill, bill], {})).toMatch(/once per tab/)
  })

  it('requires a heading and a definition within their limits', () => {
    expect(byName('heading')).toMatchObject({ required: true, maxLength: FACT_TABS_LIMITS.heading })
    expect(byName('definition')).toMatchObject({
      type: 'textarea',
      required: true,
      maxLength: FACT_TABS_LIMITS.definition,
    })
  })

  it('shares the key fact fields with the key facts block, and every limit with the code that checks it', () => {
    const own = fieldsOf(keyFactFields())
    for (const field of own) {
      if ('name' in field) expect(byName(field.name)).toBeDefined()
    }
    expect(byName('value')).toMatchObject({ maxLength: KEY_FACT_LIMITS.value })
    // A tab's label sits on one line in its button (#1112), a card's label may be longer
    expect(byName('label')).toMatchObject({ maxLength: FACT_TABS_LIMITS.label })
    expect(FACT_TABS_LIMITS.label).toBeLessThan(KEY_FACT_LIMITS.label)
    expect(byName('entries')).toMatchObject({
      minRows: TIMELINE_LIMITS.minEntries,
      maxRows: TIMELINE_LIMITS.maxEntries,
    })
  })

  describe('blank text', () => {
    type Check = (value: unknown, args: object) => true | string
    it.each(['value', 'label', 'heading', 'definition'])(
      '%s refuses text of only spaces, in the key facts block too',
      (name) => {
        const check = byName(name).validate as unknown as Check
        const args = {
          required: true,
          req: { t: (key: string) => key, payload: { config: { localization: false } } },
        }
        expect(typeof check('   ', args)).toBe('string')
        expect(check('Fine', args)).toBe(true)
        if (name === 'value' || name === 'label') {
          const shared = fieldsOf(KeyFactsBlockConfig.fields).find(
            (f) => 'name' in f && f.name === name,
          ) as unknown as { validate: Check }
          expect(shared.validate).toBe(check)
        }
      },
    )
  })

  describe('the row counts, as Admin and a real save send them', () => {
    type Check = (value: unknown, args: { event?: unknown }) => true | string
    const check = (name: string) => byName(name).validate as unknown as Check

    it.each([
      ['tabs', 1, 2, 4],
      ['tabs', 5, 2, 4],
      ['panel', 0, 1, 3],
    ])('%s: says why under the field while Admin counts %i rows', (name, rows, min, max) => {
      const noun = name === 'tabs' ? 'tabs' : 'pictures'
      expect(check(name)(rows, { event: 'onChange' })).toMatch(new RegExp(`^Add ${min} to ${max}`))
      expect(check(name)(rows, { event: 'onChange' })).toContain(noun)
    })

    it.each([
      ['tabs', 2],
      ['tabs', 4],
      ['panel', 1],
    ])('%s: adding the row that makes %i clears the message at once', (name, rows) => {
      expect(check(name)(rows, { event: 'onChange' })).toBe(true)
    })

    it('judges the rows Admin sends as they are, even when a fresh row holds only its id', () => {
      expect(check('tabs')([{ id: 'a' }], { event: 'onChange' })).toMatch(/there is 1/)
      expect(check('tabs')([{ id: 'a' }, { id: 'b' }], { event: 'onChange' })).toBe(true)
      expect(check('panel')([], { event: 'onChange' })).toMatch(/there are 0/)
    })

    it.each(['tabs', 'panel'])(
      '%s: gives no opinion on what Admin sends that cannot be counted',
      (name) => {
        for (const value of [undefined, null, 'x', {}]) {
          expect(check(name)(value, { event: 'onChange' })).toBe(true)
        }
      },
    )

    it.each([
      ['tabs', 2, 4],
      ['panel', 1, 3],
    ])(
      '%s: judges the real save, %i to %i rows, and reads a count as no rows',
      (name, min, max) => {
        const rows = (n: number) => Array.from({ length: n }, () => ({}))
        for (const event of ['submit', undefined]) {
          expect(check(name)(rows(min), { event })).toBe(true)
          expect(check(name)(rows(max), { event })).toBe(true)
          expect(check(name)(rows(min - 1), { event })).toMatch(/^Add \d to \d/)
          expect(check(name)(rows(max + 1), { event })).toMatch(/^Add \d to \d/)
          expect(check(name)(max, { event })).toMatch(/there are 0/)
          expect(check(name)(undefined, { event })).toMatch(/^Add/)
        }
      },
    )

    it('keeps the limits on the fields too, so the Add button stops at the most', () => {
      expect(byName('tabs')).toMatchObject({ minRows: 2, maxRows: 4 })
    })
  })

  it('converts to and from Markdown', () => {
    expect(typeof FactTabsBlockConfig.jsx?.export).toBe('function')
    expect(typeof FactTabsBlockConfig.jsx?.import).toBe('function')
  })
})
