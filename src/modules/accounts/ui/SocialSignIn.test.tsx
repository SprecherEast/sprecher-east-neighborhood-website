// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { continuePage } from './continuePage'
import { SocialSignIn, SocialSignInMessage } from './SocialSignIn'

afterEach(cleanup)

describe('SocialSignIn', () => {
  it('shows nothing when no provider is on', () => {
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

  it('puts Google’s own “G” before the words, as decoration, and keeps the button’s name (#1365)', () => {
    render(<SocialSignIn providers={['google']} />)
    const google = screen.getByRole('button', { name: 'Continue with Google' })
    const logo = google.querySelector('img')

    expect(logo?.getAttribute('src')).toBe('/brand/google-g.png')
    expect(logo?.getAttribute('alt')).toBe('')
    // Full width like the other quick ways, so the buttons line up
    expect(google.className).toMatch(/w-full/)
    // The kit's `lg` button, 48 px tall, like the passkey button (#1375)
    expect(google.className).toMatch(/min-h-12/)
  })
})

describe('SocialSignInMessage', () => {
  it('shows nothing when no sign-in came back', () => {
    const { container } = render(<SocialSignInMessage />)
    expect(container.innerHTML).toBe('')
  })

  it('shows a fixed message for a known outcome, and nothing for anything else', () => {
    render(<SocialSignInMessage result="unavailable" />)
    expect(screen.getByRole('alert').textContent).toContain(
      'We couldn’t sign you in to this account',
    )
    cleanup()
    // The old "use your password" refusal is gone: the password step replaced it
    const { container: old } = render(<SocialSignInMessage result="email-in-use" />)
    expect(old.innerHTML).toBe('')
    cleanup()
    const { container } = render(<SocialSignInMessage result="<script>" />)
    expect(container.innerHTML).toBe('')
    cleanup()
    render(<SocialSignInMessage result="toString" />)
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
