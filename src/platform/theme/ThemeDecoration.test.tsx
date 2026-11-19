// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { ThemeDecoration } from './ThemeDecoration'

afterEach(cleanup)

describe('ThemeDecoration (#409)', () => {
  it('draws nothing for the default theme', () => {
    const { container } = render(<ThemeDecoration />)
    expect(container.innerHTML).toBe('')
  })

  it('draws nothing when no decoration is asked for', () => {
    const { container } = render(<ThemeDecoration decoration={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('draws a decoration as a layer people and screen readers pass through', async () => {
    const { container } = render(
      <main>
        <p>Content</p>
        <ThemeDecoration decoration="snowfall" />
      </main>,
    )
    const layer = container.querySelector('[data-decoration="snowfall"]')
    expect(layer?.getAttribute('aria-hidden')).toBe('true')
    expect(layer?.className).toContain('pointer-events-none')
    expect(layer?.className).toContain('theme-decoration-snowfall')
    await expectAccessible(document.body)
  })
})
