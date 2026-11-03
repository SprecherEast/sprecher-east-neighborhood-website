import { describe, expect, it } from 'vitest'

import type { RichTextValue } from '@/platform/lib'

import { headingAnchors } from './headingAnchors'

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

  it('returns nothing for no content', () => {
    expect(headingAnchors(null)).toEqual([])
    expect(headingAnchors(undefined)).toEqual([])
  })
})
