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
})
