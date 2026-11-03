// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { MIN_PASSWORD_LENGTH } from '../domain/credentials'
import { NewPasswordFields } from './NewPasswordFields.client'

afterEach(cleanup)

const descriptionOf = (el: HTMLElement) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')

type Values = { newPassword: string; confirmPassword: string }

function Harness({
  label,
  errors,
}: {
  label?: string
  errors?: Parameters<typeof NewPasswordFields>[0]['errors']
}) {
  const { register } = useForm<Values>()
  return (
    <form aria-label="Test">
      <NewPasswordFields register={register} errors={errors ?? {}} label={label} />
    </form>
  )
}

describe('NewPasswordFields', () => {
  it('asks for the password and its confirmation, with the length hint', async () => {
    render(<Harness />)
    expect(screen.getByLabelText(/^New password/).getAttribute('name')).toBe('newPassword')
    expect(screen.getByLabelText(/^Confirm new password/).getAttribute('name')).toBe(
      'confirmPassword',
    )
    expect(screen.getByText(`At least ${MIN_PASSWORD_LENGTH} characters.`)).toBeTruthy()
    await expectAccessible(document.body)
  })

  it('takes its label from the form, for an account that is new', () => {
    render(<Harness label="Password" />)
    expect(screen.getByLabelText(/^Password/).getAttribute('name')).toBe('newPassword')
    expect(screen.getByLabelText(/^Confirm password/)).toBeTruthy()
  })

  it('shows each field its own error', () => {
    render(
      <Harness
        errors={{
          newPassword: { message: 'Too short.' },
          confirmPassword: { message: 'Does not match.' },
        }}
      />,
    )
    expect(descriptionOf(screen.getByLabelText(/^New password/))).toMatch(/Too short\./)
    expect(descriptionOf(screen.getByLabelText(/^Confirm new password/))).toMatch(
      /Does not match\./,
    )
  })
})
