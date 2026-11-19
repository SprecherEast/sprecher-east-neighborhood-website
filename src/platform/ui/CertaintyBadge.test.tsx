// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CERTAINTY_LABELS, CERTAINTIES } from '@/platform/lib/certainty'

import { CertaintyBadge } from './CertaintyBadge'

afterEach(cleanup)

describe('CertaintyBadge', () => {
  it.each(CERTAINTIES)('says %s in words, with a decorative icon', (certainty) => {
    const { container } = render(<CertaintyBadge certainty={certainty} />)
    expect(screen.getByText(CERTAINTY_LABELS[certainty])).toBeTruthy()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('can write its own words in place of the certainty’s, keeping the look', () => {
    const { container } = render(<CertaintyBadge certainty="estimate" label="Proposed" />)
    expect(screen.getByText('Proposed').className).toContain('text-warning-strong')
    expect(screen.queryByText(CERTAINTY_LABELS.estimate)).toBeNull()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})
