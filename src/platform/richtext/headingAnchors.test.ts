import { describe, expect, it } from 'vitest'

import type { RichTextValue } from '@/platform/lib'

import { anchorsByNode, headingAnchors } from './headingAnchors'

const text = (value: string) => ({ type: 'text', text: value, version: 1 })
const heading = (tag: string, ...children: unknown[]) => ({
  type: 'heading',
  tag,
  version: 1,
  children,
})
const doc = (...children: unknown[]) =>
  ({ root: { type: 'root', version: 1, children } }) as unknown as RichTextValue

describe('headingAnchors', () => {
  it('gives each h2 and h3 a readable id, in reading order', () => {
    expect(
      headingAnchors(doc(heading('h2', text("What's next?")), heading('h3', text('Who gains')))),
    ).toEqual([
      { id: 'whats-next', text: "What's next?", level: 2 },
      { id: 'who-gains', text: 'Who gains', level: 3 },
    ])
  })

  it('numbers a repeated heading, and gives the same ids on every call', () => {
    const value = doc(
      heading('h2', text('Costs')),
      heading('h2', text('Costs')),
      heading('h3', text('Costs')),
    )
    const ids = headingAnchors(value).map((a) => a.id)
    expect(ids).toEqual(['costs', 'costs-2', 'costs-3'])
    expect(headingAnchors(value).map((a) => a.id)).toEqual(ids)
  })

  it('never gives two headings the same id, even when one is already called "costs-2"', () => {
    const ids = headingAnchors(
      doc(
        heading('h2', text('Costs')),
        heading('h2', text('Costs')),
        heading('h2', text('Costs 2')),
      ),
    ).map((a) => a.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('keeps ids unique when "Costs 2" comes first', () => {
    const ids = headingAnchors(
      doc(
        heading('h2', text('Costs 2')),
        heading('h2', text('Costs')),
        heading('h2', text('Costs')),
      ),
    ).map((a) => a.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('reads a line break in a heading as a space between words', () => {
    const value = doc(heading('h2', text('Next'), { type: 'linebreak', version: 1 }, text('steps')))
    expect(headingAnchors(value)[0]).toEqual({ id: 'next-steps', text: 'Next steps', level: 2 })
  })

  it('folds accents into their letters and drops punctuation', () => {
    const value = doc(heading('h2', text('Café "Big" Plan: 2027 & beyond')))
    expect(headingAnchors(value)[0]?.id).toBe('cafe-big-plan-2027-beyond')
  })

  it('joins styled and linked pieces of one heading into its words', () => {
    const link = { type: 'link', version: 1, children: [text('the plan')] }
    expect(headingAnchors(doc(heading('h2', text('Read '), link)))[0]?.text).toBe('Read the plan')
  })

  it('skips empty headings, h1 and h4, and finds headings inside quotes', () => {
    const quote = { type: 'quote', version: 1, children: [heading('h3', text('Inside'))] }
    expect(
      headingAnchors(
        doc(
          heading('h2'),
          heading('h2', text('  ')),
          heading('h1', text('Title')),
          heading('h4', text('Deep')),
          quote,
        ),
      ),
    ).toEqual([{ id: 'inside', text: 'Inside', level: 3 }])
  })

  it('falls back to "section" when no letters or digits are left', () => {
    expect(headingAnchors(doc(heading('h2', text('???'))))[0]?.id).toBe('section')
  })

  it('ignores block nodes, which render their own headings', () => {
    const block = { type: 'block', version: 1, fields: { heading: 'Inside a block' } }
    expect(headingAnchors(doc(block, heading('h2', text('Real'))))).toEqual([
      { id: 'real', text: 'Real', level: 2 },
    ])
  })

  describe('inside section tabs (#1333)', () => {
    const tabs = (...panels: unknown[][]) => ({
      type: 'block',
      version: 1,
      fields: {
        blockType: 'sectionTabs',
        tabs: panels.map((children, index) => ({
          label: `Tab ${index}`,
          panel: { root: { type: 'root', version: 1, children } },
        })),
      },
    })

    it('lists the headings in every tab, in reading order, with the article’s own', () => {
      const value = doc(
        heading('h2', text('Before')),
        tabs([heading('h3', text('One'))], [heading('h3', text('Two')), heading('h4', text('No'))]),
        heading('h2', text('After')),
      )
      expect(headingAnchors(value)).toEqual([
        { id: 'before', text: 'Before', level: 2 },
        { id: 'one', text: 'One', level: 3 },
        { id: 'two', text: 'Two', level: 3 },
        { id: 'after', text: 'After', level: 2 },
      ])
    })

    it('numbers a heading that repeats across the article and a tab, and keeps the node’s id', () => {
      const inTab = heading('h3', text('Costs'))
      const value = doc(heading('h2', text('Costs')), tabs([inTab]))
      const anchors = anchorsByNode(value)
      expect(anchors.get(inTab)?.id).toBe('costs-2')
    })

    it('is not troubled by a tab with no content', () => {
      const broken = { type: 'block', fields: { blockType: 'sectionTabs', tabs: [{ label: 'x' }] } }
      expect(headingAnchors(doc(broken, heading('h2', text('Real'))))).toHaveLength(1)
    })
  })

  it('returns nothing for no content', () => {
    expect(headingAnchors(null)).toEqual([])
    expect(headingAnchors(undefined)).toEqual([])
  })
})
