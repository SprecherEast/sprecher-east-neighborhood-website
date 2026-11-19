// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeTurnstile } from '@/platform/turnstile/testing/fakeTurnstileWidget'
import { useConfirmedEmail } from '@/platform/ui/ConfirmedEmail.client'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { ConfirmEmail } from './ConfirmEmail.client'

vi.mock(
  '@/platform/turnstile/TurnstileWidget.client',
  () => import('@/platform/turnstile/testing/fakeTurnstileWidget'),
)

const TOKEN = 'a'.repeat(43)
const fetchMock = vi.fn()

beforeEach(() => {
  fakeTurnstile.tokenFor = (reset) => `token-${reset}`
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  // The page as the link opens it
  window.history.replaceState(null, '', `/confirm-email?token=${TOKEN}`)
})
afterEach(cleanup)

const answer = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }))

const clickConfirm = () => userEvent.click(screen.getByRole('button', { name: 'Confirm my email' }))

describe('ConfirmEmail', () => {
  it('does nothing until the button is clicked, then posts the token', async () => {
    answer(200, { outcome: 'confirmed' })
    render(
      <main>
        <ConfirmEmail token={TOKEN} status="pending" retryHref="/contact">
          <p>Account offer</p>
        </ConfirmEmail>
      </main>,
    )
    await expectAccessible(document.body)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Account offer')).toBeNull()

    await clickConfirm()

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toMatch(/\/api\/email-confirmations\/confirm$/)
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ token: TOKEN }) })
    // The robot check's token goes with it (#303)
    expect(new Headers(init?.headers).get('x-turnstile-token')).toBe('token-0')
    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('your email is confirmed')
    expect(status.parentElement?.contains(document.activeElement)).toBe(true)
    expect(window.location.search).toBe('')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Account offer')).toBeTruthy()
    await expectAccessible(document.body)
  })

  it('gives what comes after the confirmed address the endpoint answered with', async () => {
    answer(200, { outcome: 'confirmed', email: 'ana@example.com' })
    const Slot = () => <p>Offer for {useConfirmedEmail() ?? 'nobody'}</p>
    render(
      <ConfirmEmail token={TOKEN} status="pending" retryHref="/contact">
        <Slot />
      </ConfirmEmail>,
    )
    await clickConfirm()
    expect(await screen.findByText('Offer for ana@example.com')).toBeTruthy()
  })

  it('gives no address when the answer has none, or not a plain one', async () => {
    answer(200, { outcome: 'already-confirmed', email: 'a@b.co, c@d.co' })
    const Slot = () => <p>Offer for {useConfirmedEmail() ?? 'nobody'}</p>
    render(
      <ConfirmEmail token={TOKEN} status="pending" retryHref="/contact">
        <Slot />
      </ConfirmEmail>,
    )
    await clickConfirm()
    expect(await screen.findByText('Offer for nobody')).toBeTruthy()
  })

  it('says a reused link is already confirmed, and shows what comes after', async () => {
    answer(200, { outcome: 'already-confirmed' })
    render(
      <ConfirmEmail token={TOKEN} status="pending" retryHref="/contact">
        <p>Account offer</p>
      </ConfirmEmail>,
    )
    await clickConfirm()
    expect((await screen.findByRole('status')).textContent).toContain('already confirmed')
    expect(screen.getByText('Account offer')).toBeTruthy()
  })

  it.each([
    ['expired', 200, { outcome: 'expired' }, 'This link has expired'],
    ['invalid', 200, { outcome: 'invalid' }, 'This link isn’t valid'],
  ])(
    'explains an %s link, points to the contact form and offers no button',
    async (_, status, body, text) => {
      answer(status, body)
      render(<ConfirmEmail token={TOKEN} status="pending" retryHref="/contact" />)
      await clickConfirm()
      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain(text)
      expect(alert.parentElement?.contains(document.activeElement)).toBe(true)
      expect(
        screen.getByRole('link', { name: 'Go to the contact form' }).getAttribute('href'),
      ).toBe('/contact')
      expect(window.location.search).toBe('')
      expect(screen.queryByRole('button')).toBeNull()
    },
  )

  it.each([
    ['too many tries', () => answer(429, { error: 'x' }), 'Too many tries'],
    ['a server error', () => answer(500, { error: 'x' }), 'Something went wrong'],
    ['an unknown answer', () => answer(200, { outcome: 'hacked' }), 'Something went wrong'],
    ['no answer', () => fetchMock.mockRejectedValue(new TypeError('x')), 'couldn’t reach'],
  ])('lets the person try again after %s', async (_, setUp, text) => {
    setUp()
    render(<ConfirmEmail token={TOKEN} status="pending" retryHref="/contact" />)
    await clickConfirm()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(text)
    expect(alert.parentElement?.contains(document.activeElement)).toBe(true)
    expect(window.location.search).toBe(`?token=${TOKEN}`)
    expect(screen.getByRole('button', { name: 'Confirm my email' })).toBeTruthy()
  })

  it('sends nothing while the robot check is still running, and says why (#303)', async () => {
    fakeTurnstile.tokenFor = () => null
    render(<ConfirmEmail token={TOKEN} status="pending" retryHref="/contact" />)
    await clickConfirm()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('the spam check is still running')
  })

  it('says when the robot check fails, and sends a fresh token on the next press', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'robot-check' }), { status: 400 }),
    )
    render(<ConfirmEmail token={TOKEN} status="pending" retryHref="/contact" />)
    await clickConfirm()
    expect((await screen.findByRole('alert')).textContent).toContain('spam check didn’t pass')

    answer(200, { outcome: 'confirmed' })
    await clickConfirm()
    await screen.findByText(/your email is confirmed/)
    const [, init] = fetchMock.mock.calls[1] ?? []
    expect(new Headers(init?.headers).get('x-turnstile-token')).toBe('token-1')
  })

  it('ignores an answer that arrives after the person left the page', async () => {
    let reply: (r: Response) => void = () => {}
    fetchMock.mockReturnValue(new Promise<Response>((r) => (reply = r)))
    const { unmount } = render(<ConfirmEmail token={TOKEN} status="pending" retryHref="/contact" />)
    await clickConfirm()
    unmount()
    window.history.replaceState(null, '', '/search?q=garden')
    reply(new Response(JSON.stringify({ outcome: 'confirmed' }), { status: 200 }))
    await new Promise((r) => setTimeout(r, 0))
    expect(window.location.search).toBe('?q=garden')
  })

  it('says a link without a usable token isn’t valid, without asking the server', async () => {
    render(
      <main>
        <ConfirmEmail token={null} status="invalid" retryHref="/contact" />
      </main>,
    )
    expect(screen.getByRole('alert').textContent).toContain('This link isn’t valid')
    expect(screen.getByRole('link', { name: 'Go to the contact form' })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(document.body) // nothing steals focus on page load
    await expectAccessible(document.body)
  })

  describe('when the link was already used or is dead as the page opens (#391)', () => {
    it('says the email is already confirmed, with no button and no account offer', async () => {
      render(
        <main>
          <ConfirmEmail token={TOKEN} status="already-confirmed" retryHref="/contact">
            <p>Account offer</p>
          </ConfirmEmail>
        </main>,
      )
      expect(screen.getByRole('status').textContent).toContain('already confirmed')
      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.queryByRole('link', { name: 'Go to the contact form' })).toBeNull()
      expect(screen.queryByText('Account offer')).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
      // The token leaves the address bar; focus stays where the page put it
      expect(window.location.search).toBe('')
      expect(document.activeElement).toBe(document.body)
      await expectAccessible(document.body)
    })

    it.each([
      ['expired', 'This link has expired'],
      ['invalid', 'This link isn’t valid'],
    ] as const)(
      'shows a %s link’s message and the contact form, with no button',
      (status, text) => {
        render(<ConfirmEmail token={TOKEN} status={status} retryHref="/contact" />)
        expect(screen.getByRole('alert').textContent).toContain(text)
        expect(screen.getByRole('link', { name: 'Go to the contact form' })).toBeTruthy()
        expect(screen.queryByRole('button')).toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
      },
    )

    it('keeps the address bar as it is for a link still to confirm', () => {
      render(<ConfirmEmail token={TOKEN} status="pending" retryHref="/contact" />)
      expect(window.location.search).toBe(`?token=${TOKEN}`)
    })
  })
})
