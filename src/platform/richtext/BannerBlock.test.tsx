// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BannerBlock } from './BannerBlock'

const content = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          {
            type: 'text',
            version: 1,
            text: 'Meeting soon',
            format: 0,
            detail: 0,
            mode: 'normal',
            style: '',
          },
        ],
      },
    ],
  },
} as React.ComponentProps<typeof BannerBlock>['content']

beforeEach(() => vi.setSystemTime(new Date('2026-11-08T12:00:00Z')))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('BannerBlock', () => {
  it('renders a banner stored before the new fields exist exactly as before: no close button', () => {
    render(<BannerBlock id="old" blockType="banner" style="info" content={content} />)

    expect(screen.getByText('Meeting soon')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('has a close button only when the editor turned it on', () => {
    render(<BannerBlock id="b" blockType="banner" style="info" dismissible content={content} />)

    expect(screen.getByRole('button', { name: 'Close this notice' })).toBeTruthy()
  })

  it('shows no close button for a block without an id, since it could not be remembered', () => {
    render(<BannerBlock blockType="banner" style="info" dismissible content={content} />)

    expect(screen.getByText('Meeting soon')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders nothing once its end time has passed', () => {
    const { container } = render(
      <BannerBlock
        id="b"
        blockType="banner"
        style="info"
        showUntil="2026-11-08T11:00:00.000Z"
        content={content}
      />,
    )

    expect(container.textContent).toBe('')
  })

  it('shows before its end time', () => {
    render(
      <BannerBlock
        id="b"
        blockType="banner"
        style="info"
        showUntil="2026-11-10T23:30:00.000Z"
        content={content}
      />,
    )

    expect(screen.getByText('Meeting soon')).toBeTruthy()
  })
})
