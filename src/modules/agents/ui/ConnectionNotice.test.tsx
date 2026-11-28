// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ConnectionNotice } from './ConnectionNotice'

afterEach(cleanup)

describe('ConnectionNotice', () => {
  it('says a request is not valid, with the reason the use case gave', () => {
    render(<ConnectionNotice notice={{ kind: 'refused', message: 'Not valid.' }} />)
    expect(screen.getByRole('alert').textContent).toContain('Not valid.')
  })

  it('asks a visitor to log in and offers the log in page it was given', () => {
    render(
      <ConnectionNotice
        notice={{ kind: 'sign-in-needed', returnTo: '/oauth/approve' }}
        signInHref="/login?next=%2Foauth%2Fapprove"
      />,
    )
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe(
      '/login?next=%2Foauth%2Fapprove',
    )
  })

  it('tells a signed-in non-admin an admin is needed, with no way to approve', () => {
    render(<ConnectionNotice notice={{ kind: 'admin-needed' }} />)
    expect(document.body.textContent).toContain('Only an admin can allow this')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('asks for a minute when there were too many tries', () => {
    render(<ConnectionNotice notice={{ kind: 'too-many' }} />)
    expect(document.body.textContent).toContain('wait a minute')
  })
})
