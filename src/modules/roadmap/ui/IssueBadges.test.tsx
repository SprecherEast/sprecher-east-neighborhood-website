// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { LabelBadges, StateBadge } from './IssueBadges'

afterEach(cleanup)

describe('StateBadge', () => {
  it('says open in green, done in purple and not planned in gray, each with its words and an icon', async () => {
    const { container } = render(
      <>
        <StateBadge state="open" />
        <StateBadge state="done" />
        <StateBadge state="not-planned" />
      </>,
    )

    const open = screen.getByText('Open')
    const done = screen.getByText('Done')
    const skipped = screen.getByText('Not planned')
    expect(open.className).toContain('text-success-strong')
    expect(done.className).toContain('text-done-strong')
    expect(skipped.className).toContain('text-muted-foreground')
    for (const badge of [open, done, skipped]) expect(badge.querySelector('svg')).not.toBeNull()
    await expectAccessible(container)
  })
})

describe('sizes (#952)', () => {
  it('makes the state mark slightly bigger and leaves the labels small', () => {
    render(
      <>
        <StateBadge state="open" />
        <LabelBadges labels={['frontend']} />
      </>,
    )

    expect(screen.getByText('Open').className).toContain('text-sm')
    expect(screen.getByText('frontend').className).toContain('text-xs')
  })
})

describe('LabelBadges', () => {
  it('shows labels as plain outlines, without the epic label', () => {
    render(<LabelBadges labels={['epic', 'frontend']} />)

    expect(screen.queryByText('epic')).toBeNull()
    expect(screen.getByText('frontend').className).not.toMatch(/bg-/)
  })
})
