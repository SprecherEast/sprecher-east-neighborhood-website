// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import type { ImageRef } from '@/platform/lib'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { TITLE_TEXT } from './blockStyles'
import { MapBlock } from './MapBlock'

afterEach(cleanup)

const preview = {
  id: 1,
  alt: 'Sprecher East, outlined, with I-94 to the north',
  url: '/api/media/file/map.png',
  filename: 'map.png',
  mimeType: 'image/png',
  width: 1017,
  height: 848,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
} as ImageRef

const props = {
  title: 'Where Sprecher East is',
  description: 'I-94 to the north, Sprecher Road to the west, Cottage Grove Road to the south.',
  embedUrl: 'https://www.google.com/maps/d/embed?mid=1AbC_dEf',
  preview,
}

describe('MapBlock (#764)', () => {
  it('draws the title, the description in words and the small picture', async () => {
    const { container } = render(
      <main>
        <MapBlock {...props} />
      </main>,
    )

    expect(screen.getByRole('heading', { name: 'Where Sprecher East is' })).toBeTruthy()
    expect(screen.getByText(/I-94 to the north, Sprecher Road/)).toBeTruthy()
    expect(screen.getByAltText(preview.alt as string)).toBeTruthy()
    expect(container.querySelector('iframe')).toBeNull()
    await expectAccessible(container)
  })

  it('opens the live map from the picture or the button', async () => {
    render(<MapBlock {...props} />)
    expect(screen.getAllByRole('button', { name: 'View the larger map' })).toHaveLength(2)

    await userEvent.click(screen.getAllByRole('button', { name: 'View the larger map' })[1])

    const dialog = screen.getByRole('dialog', { name: 'Where Sprecher East is' })
    expect(dialog.querySelector('iframe')?.getAttribute('src')).toBe(props.embedUrl)
  })

  it('shows the picture and text only until an editor adds the Google address', () => {
    render(<MapBlock {...props} embedUrl={undefined} />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByAltText(preview.alt as string)).toBeTruthy()
  })

  it('fills the width of the section item it sits in, with no arrangement of its own', () => {
    const { container } = render(<MapBlock {...props} />)

    expect(container.querySelector('[class*="grid-cols"]')).toBeNull()
    expect(container.querySelector('[class*="md:order"]')).toBeNull()
  })

  it('draws the heading, the picture, then the text under it', () => {
    render(<MapBlock {...props} />)
    const heading = screen.getByText(props.title)
    const picture = screen.getByAltText(preview.alt as string)
    const text = screen.getByText(/I-94 to the north, Sprecher Road/)

    expect(heading.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(picture.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('draws without its own container or padding when it sits inside a section item', () => {
    const { container } = render(<MapBlock {...props} placement="inline" />)

    expect(container.querySelector('.container')).toBeNull()
    expect(container.firstElementChild?.className).not.toContain('py-')
  })

  // The text blocks beside it head their part at this size, so the two columns read as one set (#891)
  it('heads the map at the same size as the text blocks around it', () => {
    render(<MapBlock {...props} />)
    const heading = screen.getByRole('heading', { name: props.title })
    // the same class the text blocks put on their title wrapper, so one edit moves both
    expect(heading.parentElement?.className).toBe(TITLE_TEXT)
  })
})
