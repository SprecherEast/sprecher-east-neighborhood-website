// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { Media } from '@/payload-types'

import { MediaBlock } from './MediaBlock'

afterEach(cleanup)

const STATIC_IMAGE = { src: '/map.png', width: 640, height: 480 }

const caption = (value: string): Media['caption'] => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [
          {
            type: 'text',
            text: value,
            format: 0,
            detail: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
        ],
      },
    ],
  },
})

const mediaWithCaption: Media = {
  id: 1,
  alt: 'Concept map',
  caption: caption('Source: WisDOT'),
  url: '/api/media/file/map.png',
  width: 640,
  height: 480,
  createdAt: '2026-10-31T00:00:00.000Z',
  updatedAt: '2026-10-31T00:00:00.000Z',
}

/** The block's outer element: the one that owns the space around the image */
const wrapper = (container: HTMLElement) => container.firstElementChild as HTMLElement

describe('MediaBlock spacing (#541)', () => {
  it('is its own section in the page builder: container and section padding', () => {
    const { container } = render(
      <MediaBlock blockType="mediaBlock" media={1} staticImage={STATIC_IMAGE} />,
    )

    expect(wrapper(container).className).toContain('container')
    expect(wrapper(container).className).toContain('py-10')
    expect(wrapper(container).className).toContain('md:py-14')
    expect(container.querySelector('.not-prose')).toBeNull()
  })

  it('inline in rich text it sets one margin and opts out of the prose styles', () => {
    const { container } = render(
      <MediaBlock blockType="mediaBlock" media={1} staticImage={STATIC_IMAGE} placement="inline" />,
    )

    const classes = wrapper(container).className
    // The shared gap (`--figure-gap`), which a legend under the image reaches back over (#636),
    // and a stacking level above that legend, so the legend's top hides beneath the image
    expect(classes).toContain('my-[var(--figure-gap)]')
    expect(classes).toContain('relative')
    expect(classes).toContain('z-10')
    // No second layer of spacing: neither the section padding nor a container
    expect(classes).not.toMatch(/\bpy-/)
    expect(classes).not.toMatch(/\bmd:py-/)
    expect(classes).not.toContain('container')
    // The `prose` typography margin on <picture> is switched off for the image
    expect(container.querySelector('picture')?.closest('.not-prose')).not.toBeNull()
  })

  it('keeps the caption in prose when inline, so only the image opts out', () => {
    const { container } = render(
      <MediaBlock
        blockType="mediaBlock"
        media={mediaWithCaption}
        placement="inline"
        captionClassName="mx-auto max-w-[48rem]"
      />,
    )

    const captionText = screen.getByText('Source: WisDOT')
    expect(captionText.closest('.not-prose')).toBeNull()
    expect(captionText.closest('.prose')).not.toBeNull()
    expect(container.querySelector('.container')).toBeNull()
  })

  it('does not nest a second container around the caption in the page builder', () => {
    const { container } = render(<MediaBlock blockType="mediaBlock" media={mediaWithCaption} />)

    // One container, the block's own: a nested one would indent the caption 16px each side
    expect(container.querySelectorAll('.container')).toHaveLength(1)
    expect(screen.getByText('Source: WisDOT').closest('.container')).toBe(wrapper(container))
  })
})
