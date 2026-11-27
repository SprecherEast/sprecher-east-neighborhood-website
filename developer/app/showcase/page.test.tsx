// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import Page from './page'

afterEach(cleanup)

describe('the showcase page (a placeholder until the shell lands, #1531)', () => {
  it('has one h1 and a way back to the developer home page', () => {
    render(<Page />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('link', { name: /developer home/i }).getAttribute('href')).toBe('/')
  })
})
