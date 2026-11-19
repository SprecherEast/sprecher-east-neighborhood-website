// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Button } from './Button'
import { Dialog } from './Dialog.client'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

function Example({ hideTitle = false }: { hideTitle?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Filters"
      hideTitle={hideTitle}
      trigger={<Button>Open filters</Button>}
    >
      <Button>Apply</Button>
    </Dialog>
  )
}

describe('Dialog', () => {
  it('opens a named, modal dialog that moves focus inside (#437)', async () => {
    render(<Example />)
    await userEvent.click(screen.getByRole('button', { name: 'Open filters' }))

    const dialog = screen.getByRole('dialog', { name: 'Filters' })
    expect(dialog.contains(document.activeElement)).toBe(true)
    await expectAccessible(document.body)
  })

  it('keeps a hidden title for screen readers', async () => {
    render(<Example hideTitle />)
    await userEvent.click(screen.getByRole('button', { name: 'Open filters' }))

    expect(screen.getByText('Filters').className).toContain('sr-only')
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeTruthy()
  })

  it('closes on Escape and gives focus back to its trigger', async () => {
    render(<Example />)
    const trigger = screen.getByRole('button', { name: 'Open filters' })
    await userEvent.click(trigger)

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('locks the page behind from scrolling while it is open', async () => {
    render(<Example />)
    await userEvent.click(screen.getByRole('button', { name: 'Open filters' }))

    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true)
    await userEvent.keyboard('{Escape}')
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
  })

  it('can be a centered panel over the page, not the whole screen (#946)', async () => {
    render(
      <Dialog open onOpenChange={() => {}} title="An issue" placement="center">
        <p>Its text</p>
      </Dialog>,
    )

    const dialog = screen.getByRole('dialog', { name: 'An issue' })
    expect(dialog.className).toContain('rounded-2xl')
    expect(dialog.className).not.toContain('inset-0')
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    await expectAccessible(document.body)
  })
})
