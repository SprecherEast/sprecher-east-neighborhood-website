// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { continuePage } from './continuePage'
import { SocialSignIn } from './SocialSignIn'

afterEach(cleanup)

describe('SocialSignIn', () => {
  it('shows nothing when no provider is on and no sign-in came back', () => {
    const { container } = render(<SocialSignIn providers={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('sends Google, when it is on, to its start with a plain GET form', async () => {
    const { container } = render(
      <main>
        <SocialSignIn providers={['google']} />
      </main>,
    )
    const google = screen.getByRole('button', { name: 'Continue with Google' })
    expect(google.getAttribute('type')).toBe('submit')
    const form = google.closest('form')
    expect(form?.getAttribute('action')).toBe('/auth/google')
    expect(form?.getAttribute('method')).toBe('get')
    await expectAccessible(container)
  })

  it('shows a fixed message for a known outcome, and nothing for anything else', () => {
    render(<SocialSignIn providers={[]} result="unavailable" />)
    expect(screen.getByRole('alert').textContent).toContain(
      'We couldn’t sign you in to this account',
    )
    cleanup()
    // The old "use your password" refusal is gone: the password step replaced it
    const { container: old } = render(<SocialSignIn providers={[]} result="email-in-use" />)
    expect(old.innerHTML).toBe('')
    cleanup()
    const { container } = render(<SocialSignIn providers={[]} result="<script>" />)
    expect(container.innerHTML).toBe('')
    cleanup()
    render(<SocialSignIn providers={[]} result="toString" />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('continuePage', () => {
  it('moves on to the path with a meta refresh and a link, and is never cached', async () => {
    const response = continuePage('/account')
    expect(response.headers.get('cache-control')).toBe('no-store')
    const html = await response.text()
    expect(html).toContain('<meta http-equiv="refresh" content="0;url=/account">')
    expect(html).toContain('<a href="/account">')
    expect(html).not.toContain('<script')
    // So a browser in dark mode doesn't flash white before it moves on
    expect(html).toContain('<meta name="color-scheme" content="light dark">')
  })

  it('keeps only path characters', async () => {
    const html = await continuePage('/account"><script>').text()
    expect(html).toContain('url=/accountscript')
    expect(html).not.toContain('<script>')
  })
})
