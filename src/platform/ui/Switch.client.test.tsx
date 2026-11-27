// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Field } from './Field.client'
import { Switch } from './Switch.client'
import { expectAccessible } from './testing/expectAccessible'

// Radix Switch measures itself with ResizeObserver inside a form, which jsdom lacks
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(cleanup)

describe('Switch', () => {
  it('is a switch named by its label, off until turned on', () => {
    render(<Switch label="Dark mode" />)

    const control = screen.getByRole('switch', { name: 'Dark mode' })
    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(control.getAttribute('data-state')).toBe('unchecked')
  })

  it('turns on and off by a click on the switch, announcing each state', async () => {
    const onCheckedChange = vi.fn()
    render(<Switch label="Dark mode" onCheckedChange={onCheckedChange} />)
    const control = screen.getByRole('switch', { name: 'Dark mode' })

    await userEvent.click(control)
    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(onCheckedChange).toHaveBeenLastCalledWith(true)

    await userEvent.click(control)
    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(onCheckedChange).toHaveBeenLastCalledWith(false)
  })

  it('turns on from a click on its visible label', async () => {
    render(<Switch label="Dark mode" />)

    await userEvent.click(screen.getByText('Dark mode'))

    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
  })

  it('turns on and off from the keyboard with Space and with Enter', async () => {
    render(<Switch label="Dark mode" />)
    const control = screen.getByRole('switch')

    await userEvent.tab()
    expect(document.activeElement).toBe(control)

    await userEvent.keyboard(' ')
    expect(control.getAttribute('aria-checked')).toBe('true')

    await userEvent.keyboard('{Enter}')
    expect(control.getAttribute('aria-checked')).toBe('false')
  })

  it('follows a value the caller holds', async () => {
    const onCheckedChange = vi.fn()
    const { rerender } = render(
      <Switch label="Dark mode" checked={false} onCheckedChange={onCheckedChange} />,
    )
    const control = screen.getByRole('switch')

    await userEvent.click(control)
    // The caller has not changed its value, so the switch has not moved
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(control.getAttribute('aria-checked')).toBe('false')

    rerender(<Switch label="Dark mode" checked onCheckedChange={onCheckedChange} />)
    expect(control.getAttribute('aria-checked')).toBe('true')
  })

  it('starts on with defaultChecked', () => {
    render(<Switch label="Dark mode" defaultChecked />)

    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
  })

  it('ignores a click and a key when disabled, and cannot be tabbed to', async () => {
    const onCheckedChange = vi.fn()
    render(<Switch label="Dark mode" disabled onCheckedChange={onCheckedChange} />)
    const control = screen.getByRole('switch')

    await userEvent.click(control)
    await userEvent.click(screen.getByText('Dark mode'))
    await userEvent.tab()
    await userEvent.keyboard(' ')

    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(control.hasAttribute('disabled')).toBe(true)
    expect(document.activeElement).not.toBe(control)
  })

  it('keeps the label for screen readers only with hideLabel', () => {
    render(<Switch label="Dark mode" hideLabel />)

    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeTruthy()
    expect(screen.getByText('Dark mode').className).toContain('sr-only')
  })

  it('takes part in a form by its name and value', () => {
    const { container } = render(
      <form>
        <Switch label="Send me updates" name="updates" value="yes" defaultChecked />
      </form>,
    )

    const data = new FormData(container.querySelector('form') as HTMLFormElement)
    expect(data.get('updates')).toBe('yes')
  })

  it('has a 44 px touch target, tokens only, a focus ring and calm motion', () => {
    render(<Switch label="Dark mode" />)
    const { className } = screen.getByRole('switch')

    // The track is 24 px tall; the after: area reaches 44 px (WCAG 2.5.8)
    expect(className).toContain('h-6')
    expect(className).toContain('after:-inset-y-2.5')
    expect(className).toContain('focus-visible:outline-ring')
    expect(className).toContain('border-input')
    expect(className).toContain('data-[state=checked]:bg-primary-fill')
    expect(className).toContain('motion-reduce:transition-none')
    expect(className).not.toMatch(/#[0-9a-f]{3,6}|\b(?:bg|text|border)-(?:white|black|gray|slate)/)
  })

  it('slides its thumb the other way in a right-to-left page', () => {
    render(<Switch label="Dark mode" />)
    const thumb = screen.getByRole('switch').firstElementChild as HTMLElement

    expect(thumb.className).toContain('data-[state=checked]:translate-x-5')
    expect(thumb.className).toContain('rtl:data-[state=checked]:-translate-x-5')
    expect(thumb.className).toContain('motion-reduce:transition-none')
  })

  it('has no accessibility violations, on, off, disabled and with a hidden label', async () => {
    const { container } = render(
      <div>
        <Switch label="Off" />
        <Switch label="On" defaultChecked />
        <Switch label="Disabled" disabled />
        <Switch label="Hidden label" hideLabel />
      </div>,
    )

    await expectAccessible(container)
  })
})

describe('Field.Switch', () => {
  it('lays out inline and turns on from the field label', async () => {
    const onCheckedChange = vi.fn()
    const { container } = render(
      <Field label="Email me about events">
        <Field.Switch onCheckedChange={onCheckedChange} />
      </Field>,
    )

    await userEvent.click(screen.getByText('Email me about events'))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(
      screen.getByRole('switch', { name: 'Email me about events' }).getAttribute('aria-checked'),
    ).toBe('true')
    expect((container.firstElementChild as HTMLElement).className).toContain('flex-row')
  })

  it('is described by the hint and marked invalid with the error', () => {
    render(
      <Field label="Email me about events" hint="At most one a week." error="Choose one">
        <Field.Switch />
      </Field>,
    )
    const control = screen.getByRole('switch')

    expect(control.getAttribute('aria-invalid')).toBe('true')
    const described = (control.getAttribute('aria-describedby') ?? '').split(' ')
    expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'At most one a week.',
      'Choose one',
    ])
  })

  it('has no accessibility violations in a field with a hint and an error', async () => {
    const { container } = render(
      <form>
        <Field label="Email me about events" hint="At most one a week." error="Choose one">
          <Field.Switch name="events" />
        </Field>
      </form>,
    )

    await expectAccessible(container)
  })
})
