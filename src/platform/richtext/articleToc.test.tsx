// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { RichTextValue } from '@/platform/lib'

import { articleToc } from './articleToc'

afterEach(cleanup)

const heading = (tag: 'h2' | 'h3', text: string) => ({
  type: 'heading',
  tag,
  version: 1,
  children: [{ type: 'text', text, version: 1 }],
})
const doc = (...children: unknown[]) =>
  ({ root: { type: 'root', version: 1, children } }) as unknown as RichTextValue

describe('articleToc', () => {
  it('is nothing for no content or fewer than three sections', () => {
    expect(articleToc(null)).toBeUndefined()
    expect(articleToc(doc(heading('h2', 'One'), heading('h2', 'Two')))).toBeUndefined()
  })

  it('is the menu for three or more sections', () => {
    const { container } = render(
      <>{articleToc(doc(heading('h2', 'One'), heading('h3', 'Two'), heading('h2', 'Three')))}</>,
    )
    expect(container.querySelector('nav[aria-label="On this page"]')).not.toBeNull()
    expect(container.querySelector('a[href="#two"]')?.textContent).toBe('Two')
  })
})
