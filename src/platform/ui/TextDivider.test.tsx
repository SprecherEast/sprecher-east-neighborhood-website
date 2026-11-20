// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { TextDivider } from './TextDivider'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('TextDivider', () => {
  it('reads as its words, with a line on each side that screen readers skip (#1365)', async () => {
    const { container } = render(<TextDivider>Or use your email and password</TextDivider>)

    expect(screen.getByText('Or use your email and password')).toBeTruthy()
    const lines = container.querySelectorAll('[aria-hidden="true"]')
    expect(lines).toHaveLength(2)
    await expectAccessible(container)
  })

  it('draws its lines from theme tokens only', () => {
    const { container } = render(<TextDivider>Or</TextDivider>)

    expect(container.innerHTML).toContain('bg-border')
    expect(container.innerHTML).toContain('text-muted-foreground')
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}|\b(gray|slate|zinc)-/i)
  })
})
