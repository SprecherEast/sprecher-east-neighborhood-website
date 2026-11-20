// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { ConnectGoogle } from './ConnectGoogle'
import { LINK_RESULT_NOTICES, parseLinkResult } from './googleLinkMessages'

afterEach(cleanup)

describe('ConnectGoogle', () => {
  it('offers a plain GET form to the link start, in a card named Google', async () => {
    const { container } = render(
      <main>
        <ConnectGoogle connection="available" />
      </main>,
    )
    expect(screen.getByRole('region', { name: 'Google' })).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Connect Google' })
    expect(button.getAttribute('type')).toBe('submit')
    const form = button.closest('form')
    expect(form?.getAttribute('action')).toBe('/auth/google/link')
    expect(form?.getAttribute('method')).toBe('get')
    expect(screen.getByText(/We’ll ask for your password once/)).toBeTruthy()
    await expectAccessible(container)
  })

  it('says Google is connected, with no button, once the account has it', async () => {
    const { container } = render(
      <main>
        <ConnectGoogle connection="connected" />
      </main>,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Google is connected')
    await expectAccessible(container)
  })

  it('announces how a connect ended, as one message, and never as anything but a fixed text', () => {
    render(<ConnectGoogle connection="connected" result="linked" />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toContain('Next time, log in with Google')
    cleanup()
    render(<ConnectGoogle connection="available" result="taken" />)
    expect(screen.getByRole('alert').textContent).toContain('already connected to an account here')
    // The button stays, so the person can choose another Google account
    expect(screen.getByRole('button', { name: 'Connect Google' })).toBeTruthy()
    cleanup()
    render(<ConnectGoogle connection="available" result="sign-in-again" />)
    expect(screen.getByRole('status').textContent).toContain('please log in again first')
    cleanup()
    const { container } = render(<ConnectGoogle connection="available" result="<script>" />)
    expect(container.querySelector('[role=alert],[role=status]')).toBeNull()
  })
})

describe('parseLinkResult', () => {
  it('knows each outcome and nothing else, not even inherited names', () => {
    for (const key of Object.keys(LINK_RESULT_NOTICES)) {
      expect(parseLinkResult(key)).toBe(
        LINK_RESULT_NOTICES[key as keyof typeof LINK_RESULT_NOTICES],
      )
    }
    for (const bad of ['toString', '__proto__', '', undefined, ['linked'], 7]) {
      expect(parseLinkResult(bad)).toBeNull()
    }
  })

  it('keeps each text to the length of a site message', () => {
    for (const { text } of Object.values(LINK_RESULT_NOTICES)) {
      expect(text.split(/\s+/).length).toBeLessThanOrEqual(30)
    }
  })
})
