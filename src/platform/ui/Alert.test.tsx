// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Alert, type AlertTone } from './Alert'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const TONES: AlertTone[] = ['info', 'success', 'warning', 'error']

describe('Alert', () => {
  it('interrupts for an error, and waits its turn for the other tones', () => {
    render(
      <>
        <Alert tone="error">Something went wrong</Alert>
        <Alert tone="success">Saved</Alert>
      </>,
    )

    expect(screen.getByRole('alert').textContent).toBe('Something went wrong')
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive')
    expect(screen.getByRole('status').textContent).toBe('Saved')
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })

  it.each(TONES)('draws the %s tone with its own colours and an icon', (tone) => {
    const { container } = render(<Alert tone={tone}>Message</Alert>)
    const box = container.firstElementChild as HTMLElement

    expect(box.className).toMatch(/text-(foreground|\w+-strong)/)
    expect(box.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })

  it('shows a title above the message', () => {
    render(
      <Alert tone="warning" title="Heads up">
        The meeting moved to Thursday.
      </Alert>,
    )

    expect(screen.getByText('Heads up').tagName).toBe('P')
    expect(screen.getByRole('status').textContent).toBe('Heads upThe meeting moved to Thursday.')
  })

  it('draws the info tone in the info tokens, not a neutral gray (#818)', () => {
    const { container } = render(
      <Alert tone="info" live={false}>
        An upcoming meeting
      </Alert>,
    )
    const classes = (container.firstElementChild as HTMLElement).className

    expect(classes).toContain('bg-info/10')
    expect(classes).toContain('text-info-strong')
  })

  it('is not a live region when it is part of the content', () => {
    const { container } = render(
      <Alert tone="info" live={false}>
        Read in its place
      </Alert>,
    )

    expect(screen.queryByRole('status')).toBeNull()
    expect(container.firstElementChild?.hasAttribute('aria-live')).toBe(false)
  })

  it('has no accessibility violations in any tone', async () => {
    const { container } = render(
      <>
        {TONES.map((tone) => (
          <Alert key={tone} tone={tone} title={`${tone} title`}>
            {tone} message
          </Alert>
        ))}
      </>,
    )

    await expectAccessible(container)
  })
})
