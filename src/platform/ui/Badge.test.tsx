// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Badge, BadgeList } from './Badge'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('Badge', () => {
  it('is a category pill by default, in text that passes on its tint (#418)', () => {
    render(<Badge>Meeting</Badge>)

    const badge = screen.getByText('Meeting')
    expect(badge.className).toContain('text-primary-strong')
    expect(badge.className).toContain('bg-primary/10')
  })

  it('sits on its own scrim over a photo', () => {
    render(<Badge variant="on-image">Meeting</Badge>)

    expect(screen.getByText('Meeting').className).toContain('text-on-image')
    expect(screen.getByText('Meeting').className).toContain('bg-scrim/60')
  })

  it('marks a state in destructive-strong on the destructive tint, with an optional icon (#122)', async () => {
    const { container } = render(
      <Badge variant="status">
        <svg aria-hidden="true" />
        Cancelled
      </Badge>,
    )

    const badge = screen.getByText('Cancelled')
    expect(badge.className).toContain('text-destructive-strong')
    expect(badge.className).toContain('bg-destructive/10')
    expect(badge.className).toContain('[&_svg]:size-3.5')
    await expectAccessible(container)
  })

  it('marks an official meeting in the category pill’s pair, set apart by a border (#122)', async () => {
    const { container } = render(<Badge variant="official">Official meeting</Badge>)

    const badge = screen.getByText('Official meeting')
    expect(badge.className).toContain('text-primary-strong')
    expect(badge.className).toContain('bg-primary/10')
    expect(badge.className).toContain('border-primary/30')
    await expectAccessible(container)
  })

  it.each([
    ['current', 'text-primary-foreground', 'bg-primary-fill', 'Next up'],
    ['caution', 'text-warning-strong', 'bg-warning/10', 'Depends'],
    ['neutral', 'text-muted-foreground', 'bg-muted', 'Later'],
  ] as const)(
    'marks a timeline step as %s in a contract-checked pair (#507)',
    async (variant, text, background, label) => {
      const { container } = render(<Badge variant={variant}>{label}</Badge>)

      const badge = screen.getByText(label)
      expect(badge.className).toContain(text)
      expect(badge.className).toContain(background)
      await expectAccessible(container)
    },
  )

  it('lines badges up in a row that wraps, with no accessibility violations', async () => {
    const { container } = render(
      <BadgeList>
        <Badge>Meeting</Badge>
        <Badge>Parks</Badge>
      </BadgeList>,
    )

    expect(container.firstElementChild?.className).toContain('flex-wrap')
    await expectAccessible(container)
  })

  it('can lay each badge on a solid plate of the surface, so a photo behind never shows through its tint (#1024)', () => {
    const { container } = render(
      <BadgeList plated>
        <Badge>Meeting</Badge>
        {false}
        <Badge variant="status">Cancelled</Badge>
      </BadgeList>,
    )

    const plates = Array.from(container.firstElementChild?.children ?? [])
    expect(plates).toHaveLength(2)
    for (const plate of plates) {
      expect(plate.className).toContain('bg-surface')
      expect(plate.className).toContain('rounded-full')
    }
    expect(plates[0].textContent).toBe('Meeting')
  })

  it('draws badges as they are, with no plate, by default', () => {
    const { container } = render(
      <BadgeList>
        <Badge>Meeting</Badge>
      </BadgeList>,
    )

    expect(container.firstElementChild?.firstElementChild?.className).toContain('bg-primary/10')
  })

  it('marks work that is open in green, finished in purple, and a label as a plain outline (#946)', () => {
    render(
      <>
        <Badge variant="open">Open</Badge>
        <Badge variant="done">Done</Badge>
        <Badge variant="outline">frontend</Badge>
      </>,
    )

    expect(screen.getByText('Open').className).toContain('text-success-strong')
    expect(screen.getByText('Open').className).toContain('bg-success/10')
    expect(screen.getByText('Done').className).toContain('text-done-strong')
    expect(screen.getByText('Done').className).toContain('bg-done/10')
    expect(screen.getByText('frontend').className).not.toMatch(/bg-/)
  })

  it('has a tighter xs size for a row shared with a label (#1118)', () => {
    render(<Badge size="xs">Proposed</Badge>)
    const badge = screen.getByText('Proposed')
    expect(badge.className).toContain('px-2')
    expect(badge.className).toContain('py-0.5')
    expect(badge.className).toContain('[&_svg]:size-3')
  })

  it('is small by default and has a slightly bigger size with larger words and icon (#952)', () => {
    render(
      <>
        <Badge variant="open">
          <svg aria-hidden="true" />
          Open
        </Badge>
        <Badge variant="open" size="md">
          <svg aria-hidden="true" />
          Done
        </Badge>
      </>,
    )

    const small = screen.getByText('Open')
    const bigger = screen.getByText('Done')
    expect(small.className).toContain('text-xs')
    expect(small.className).toContain('[&_svg]:size-3.5')
    expect(bigger.className).toContain('text-sm')
    expect(bigger.className).toContain('[&_svg]:size-4')
    expect(bigger.className).not.toContain('text-xs')
    expect(bigger.className).not.toContain('size-3.5')
    expect(bigger.className).toContain('text-success-strong')
  })
})
