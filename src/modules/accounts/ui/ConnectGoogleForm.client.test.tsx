// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

const mocks = vi.hoisted(() => ({ connectGoogle: vi.fn(), push: vi.fn(), refresh: vi.fn() }))
vi.mock('../actions', () => ({ connectGoogle: mocks.connectGoogle }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))

import { ConnectGoogleForm } from './ConnectGoogleForm.client'

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset()
})
afterEach(cleanup)

const password = () => screen.getByLabelText<HTMLInputElement>(/^Password/)
const send = async (value = 'secret-pass') => {
  await userEvent.type(password(), value)
  await userEvent.click(screen.getByRole('button', { name: 'Connect Google' }))
}

describe('ConnectGoogleForm', () => {
  it('asks for one password a browser can fill, and nothing that names an account', async () => {
    render(
      <main>
        <ConnectGoogleForm />
      </main>,
    )
    expect(password()).toMatchObject({ type: 'password', autocomplete: 'current-password' })
    expect(screen.queryByLabelText(/email/i)).toBeNull()
    await expectAccessible(document.body)
  })

  it('sends only the password, then opens the account page', async () => {
    mocks.connectGoogle.mockResolvedValue({ ok: true })
    render(<ConnectGoogleForm />)
    await send()
    expect(mocks.connectGoogle).toHaveBeenCalledWith({ password: 'secret-pass' })
    expect(mocks.push).toHaveBeenCalledWith('/account')
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it('does not send an empty password', async () => {
    render(<ConnectGoogleForm />)
    await userEvent.click(screen.getByRole('button', { name: 'Connect Google' }))
    expect(await screen.findByText('Enter your password')).toBeTruthy()
    expect(mocks.connectGoogle).not.toHaveBeenCalled()
  })

  it('ends on the one fixed message after a refusal, with a way back to log in and no form', async () => {
    mocks.connectGoogle.mockResolvedValue({ ok: false, failure: 'failed' })
    const { container } = render(<ConnectGoogleForm />)
    await send('wrong')
    expect((await screen.findByRole('alert')).textContent).toContain(
      'We couldn’t connect Google. Please start again',
    )
    expect(screen.queryByLabelText(/^Password/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to Log In' }).getAttribute('href')).toBe('/login')
    expect(mocks.push).not.toHaveBeenCalled()
    await expectAccessible(container)
  })

  it('keeps the form after "too many", which used nothing up', async () => {
    mocks.connectGoogle.mockResolvedValue({ ok: false, failure: 'too-many' })
    render(<ConnectGoogleForm />)
    await send()
    expect((await screen.findByRole('alert')).textContent).toContain('Too many requests')
    expect(password()).toBeTruthy()
  })

  it('says so when the request gets no answer, and keeps the form', async () => {
    mocks.connectGoogle.mockRejectedValue(new Error('network'))
    render(<ConnectGoogleForm />)
    await send()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(password()).toBeTruthy()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
