// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ImageRef } from '@/platform/lib/content'

import { Media } from './Media'

afterEach(cleanup)

const photo = {
  id: 1,
  alt: 'A park scene',
  url: '/api/media/file/park.webp',
  width: 1670,
  height: 941,
  mimeType: 'image/webp',
  focalX: 25,
  focalY: 75,
  updatedAt: '2026-10-01T12:00:00.000Z',
  createdAt: '2026-10-01T12:00:00.000Z',
} as ImageRef

describe('Media', () => {
  it("crops around the upload's focal point only when asked (#1013)", () => {
    const { rerender } = render(<Media fill atFocalPoint resource={photo} />)
    expect(screen.getByRole('img').style.objectPosition).toBe('25% 75%')

    rerender(<Media fill resource={photo} />)
    expect(screen.getByRole('img').style.objectPosition).toBe('')
  })
})
