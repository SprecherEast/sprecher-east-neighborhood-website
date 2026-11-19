// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Button } from './Button'
import { Toast } from './Toast'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('Toast', () => {
  it('announces its message politely and offers an action (#434)', async () => {
    const { container } = render(
      <Toast
        message="New version available"
        action={<Button size="sm">Refresh</Button>}
        onDismiss={() => {}}
      />,
    )

    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toContain('New version available')
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
    await expectAccessible(container)
  })

  it('calls onDismiss from its close button, named for screen readers', () => {
    const onDismiss = vi.fn()
    render(<Toast message="Saved" onDismiss={onDismiss} dismissLabel="Dismiss the notice" />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss the notice' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('slides out while it is not visible', () => {
    render(<Toast message="Saved" onDismiss={() => {}} visible={false} />)

    expect(screen.getByRole('status').className).toContain('opacity-0')
  })
})
