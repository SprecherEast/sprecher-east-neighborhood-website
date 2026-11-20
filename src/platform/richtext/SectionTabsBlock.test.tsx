// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { RichTextValue } from '@/platform/lib'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { headingAnchors } from './headingAnchors'
import { RichText } from './RichText'
import { richTextBlocks } from './richTextBlocks'

beforeEach(() => window.history.replaceState(null, '', '/'))
afterEach(cleanup)

const text = (value: string) => ({ type: 'text', text: value, format: 0, version: 1 })
const paragraph = (value: string) => ({ type: 'paragraph', version: 1, children: [text(value)] })
const heading = (tag: string, value: string) => ({
  type: 'heading',
  tag,
  version: 1,
  children: [text(value)],
})
const doc = (...children: unknown[]) =>
  ({ root: { type: 'root', version: 1, children } }) as unknown as RichTextValue

const tabs = {
  type: 'block',
  version: 2,
  fields: {
    blockType: 'sectionTabs',
    tabs: [
      {
        label: 'Overview',
        panel: doc(heading('h3', 'One'), paragraph('The short version')),
      },
      {
        label: 'The plan',
        panel: doc(heading('h3', 'Costs'), paragraph('A ramp near Milwaukee Street')),
      },
    ],
  },
}
const article = doc(paragraph('Intro'), heading('h2', 'Costs'), tabs, paragraph('Outro'))

describe('the section tabs block in an article (#1333)', () => {
  it('draws each tab’s rich text in its own panel, in one column under the buttons', () => {
    const { container } = render(<RichText data={article} blocks={richTextBlocks} />)
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Overview',
      'The plan',
    ])
    const panels = [...container.querySelectorAll('[role="tabpanel"]')]
    expect(panels).toHaveLength(2)
    expect(panels[0]?.textContent).toContain('The short version')
    expect(panels[1]?.textContent).toContain('A ramp near Milwaukee Street')
    expect(panels[1]?.textContent).not.toContain('The short version')
  })

  it('gives a heading inside a tab the id the page menu links to, repeats numbered across the article', () => {
    const { container } = render(<RichText data={article} blocks={richTextBlocks} />)
    const ids = headingAnchors(article).map((anchor) => anchor.id)
    expect(ids).toEqual(['costs', 'one', 'costs-2'])
    expect(container.querySelector('h3#one')?.textContent).toBe('One')
    expect(container.querySelector('h2#costs')).toBeTruthy()
    expect(container.querySelector('h3#costs-2')?.textContent).toBe('Costs')
  })

  it('gives the same ids when the article is drawn in parts, as a post with a picture does', () => {
    const rest = doc(...(article.root.children.slice(1) as unknown as object[]))
    const { container } = render(
      <RichText data={rest} anchorSource={article} blocks={richTextBlocks} />,
    )
    expect(container.querySelector('h3#costs-2')).toBeTruthy()
  })

  it('draws a diagram key in a tab with columns that fit its room, beside a floated picture', () => {
    const withKey = doc({
      type: 'block',
      version: 2,
      fields: {
        blockType: 'sectionTabs',
        tabs: [
          {
            label: 'The plan',
            panel: doc({
              type: 'block',
              version: 2,
              fields: { blockType: 'diagramKey', items: [{ label: 'North roundabout' }] },
            }),
          },
          { label: 'Next', panel: doc(paragraph('x')) },
        ],
      },
    })
    const { container } = render(<RichText data={withKey} blocks={richTextBlocks} />)
    expect(container.querySelector('ol')?.className).toContain('@xl:grid-cols-2')
  })

  it('lays a picture and the block right after it out as one row, and leaves other panels alone', () => {
    const blockOf = (blockType: string, extra: object = {}) => ({
      type: 'block',
      version: 2,
      fields: { blockType, ...extra },
    })
    const figure = blockOf('figure', { title: 'Plan', size: 'third' })
    const key = blockOf('diagramKey', { items: [{ label: 'North roundabout' }] })
    const withPanels = doc(
      blockOf('sectionTabs', {
        tabs: [
          { label: 'The plan', panel: doc(paragraph('Intro'), figure, key) },
          { label: 'Text', panel: doc(figure, paragraph('Beside'), key) },
        ],
      }),
    )
    const { container } = render(<RichText data={withPanels} blocks={richTextBlocks} />)
    const [row, text] = [...container.querySelectorAll('[role="tabpanel"] > div')]
    expect(row?.className).toContain('md:grid')
    expect(text?.className).not.toContain('md:grid')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<RichText data={article} blocks={richTextBlocks} />)
    await expectAccessible(container)
  })
})
