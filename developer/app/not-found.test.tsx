// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import NotFound from './not-found'

afterEach(cleanup)

describe('the developer pages’ 404 page', () => {
  it('says what happened and leads back to the developer home page', () => {
    render(<NotFound />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(
      screen.getByRole('link', { name: /back to the developer home/i }).getAttribute('href'),
    ).toBe('/')
  })
})
