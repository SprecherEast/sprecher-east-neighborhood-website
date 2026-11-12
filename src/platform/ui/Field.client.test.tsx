// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Field } from './Field.client'
import { expectAccessible } from './testing/expectAccessible'

// jsdom lacks the pointer-capture and scrolling APIs Radix Select calls when it opens, and the
// ResizeObserver Radix Checkbox uses inside a form
beforeAll(() => {
  Object.assign(window.HTMLElement.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  })
})
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

const subjects = [
  { label: 'General question', value: 'general' },
  { label: 'Event idea', value: 'event' },
]

describe('Field', () => {
  it('labels its control', () => {
    render(
      <Field label="Your name">
        <Field.Input />
      </Field>,
    )

    expect(screen.getByRole('textbox', { name: 'Your name' })).toBeTruthy()
  })

  it('marks a required field, and says "required" to screen readers', () => {
    render(
      <Field label="Email" required>
        <Field.Input type="email" />
      </Field>,
    )

    expect(screen.getByRole('textbox', { name: 'Email (required)' })).toBeTruthy()
    expect(screen.getByText('*').getAttribute('aria-hidden')).toBe('true')
  })

  it('links the hint, and with an error marks the control invalid and announces it', () => {
    render(
      <Field label="Email" hint="We only use it to reply." error="Enter an email address">
        <Field.Input type="email" />
      </Field>,
    )

    const input = screen.getByRole('textbox', { name: 'Email' })
    const describedBy = input.getAttribute('aria-describedby')?.split(' ') ?? []
    const texts = describedBy.map((id) => document.getElementById(id)?.textContent)
    expect(texts).toEqual(['We only use it to reply.', 'Enter an email address'])
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert').textContent).toBe('Enter an email address')
  })

  it('is not marked invalid without an error', () => {
    render(
      <Field label="Name">
        <Field.Input />
      </Field>,
    )

    expect(screen.getByRole('textbox').hasAttribute('aria-invalid')).toBe(false)
    expect(screen.getByRole('textbox').hasAttribute('aria-describedby')).toBe(false)
  })

  it('keeps a hidden label for screen readers', () => {
    render(
      <Field label="Search" hideLabel>
        <Field.Input type="search" leadingIcon={<Search />} />
      </Field>,
    )

    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeTruthy()
    expect(screen.getByText('Search').className).toContain('sr-only')
  })

  it('shares a row only when half width', () => {
    const { container } = render(
      <>
        <Field label="First name" width="half">
          <Field.Input />
        </Field>
        <Field label="Message">
          <Field.TextArea />
        </Field>
      </>,
    )

    const [half, full] = Array.from(container.children)
    expect(half.className).toContain('sm:col-span-1')
    expect(full.className).not.toContain('col-span')
  })

  it('refuses a control placed outside a Field, which would have no label', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Field.Input />)).toThrow(/inside a <Field>/)
  })
})

describe('Field.Input and Field.TextArea', () => {
  it('pass typing to onChange', async () => {
    function Controlled() {
      const [value, setValue] = useState('')
      return (
        <>
          <Field label="Message">
            <Field.TextArea value={value} onChange={(event) => setValue(event.target.value)} />
          </Field>
          <output>{value}</output>
        </>
      )
    }
    render(<Controlled />)

    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hello')

    expect(screen.getByRole('status').textContent).toBe('Hello')
  })

  it('give each input type its role', () => {
    render(
      <>
        <Field label="Count">
          <Field.Input type="number" />
        </Field>
        <Field label="Password">
          <Field.Input type="password" />
        </Field>
      </>,
    )

    expect(screen.getByRole('spinbutton', { name: 'Count' })).toBeTruthy()
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('password')
  })
})

describe('Field.Select', () => {
  it('is a labelled combobox that shows the placeholder until something is chosen', () => {
    render(
      <Field label="Subject">
        <Field.Select options={subjects} placeholder="Choose a subject" />
      </Field>,
    )

    expect(screen.getByRole('combobox', { name: 'Subject' }).textContent).toBe('Choose a subject')
  })

  it('reports the chosen option', async () => {
    const onValueChange = vi.fn()
    render(
      <Field label="Subject">
        <Field.Select options={subjects} onValueChange={onValueChange} />
      </Field>,
    )

    await userEvent.click(screen.getByRole('combobox', { name: 'Subject' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Event idea' }))

    expect(onValueChange).toHaveBeenCalledWith('event')
    expect(screen.getByRole('combobox').textContent).toBe('Event idea')
  })

  it('is marked invalid with an error', () => {
    render(
      <Field label="Subject" error="Choose a subject">
        <Field.Select options={subjects} />
      </Field>,
    )

    expect(screen.getByRole('combobox').getAttribute('aria-invalid')).toBe('true')
  })
})

describe('Field.Checkbox', () => {
  it('lays out inline and toggles from its label too', async () => {
    const onCheckedChange = vi.fn()
    const { container } = render(
      <Field label="Keep me posted">
        <Field.Checkbox onCheckedChange={onCheckedChange} />
      </Field>,
    )

    await userEvent.click(screen.getByText('Keep me posted'))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(
      screen.getByRole('checkbox', { name: 'Keep me posted' }).getAttribute('aria-checked'),
    ).toBe('true')
    expect((container.firstElementChild as HTMLElement).className).toContain('flex-row')
  })
})

describe('Field accessibility', () => {
  it('has no violations with every control, a hint and an error', async () => {
    const { container } = render(
      <form>
        <Field label="Name" required hint="As you'd like to be addressed.">
          <Field.Input />
        </Field>
        <Field label="Email" error="Enter an email address">
          <Field.Input type="email" />
        </Field>
        <Field label="Search" hideLabel>
          <Field.Input type="search" size="lg" leadingIcon={<Search />} />
        </Field>
        <Field label="Message">
          <Field.TextArea autoGrow />
        </Field>
        <Field label="Subject" width="half">
          <Field.Select options={subjects} name="subject" />
        </Field>
        <Field label="I agree to be contacted" error="Tick this box to continue">
          <Field.Checkbox name="agree" />
        </Field>
      </form>,
    )

    await expectAccessible(container)
  })
})
