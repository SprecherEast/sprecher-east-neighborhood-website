import { describe, expect, it } from 'vitest'

import {
  HEADER_SCROLL_MARGIN,
  REVEAL_PEEK_VAR,
  REVEAL_SCROLL_MARGIN,
  SECTION_SCROLL_MARGIN,
} from './scrollMargin'

describe('scroll margins', () => {
  it('clear the header with one token, and the section bar too for article headings', () => {
    expect(HEADER_SCROLL_MARGIN).toBe('scroll-mt-[var(--header-clearance)]')
    expect(SECTION_SCROLL_MARGIN).toBe('scroll-mt-[var(--anchor-offset)]')
  })

  it('stop an opened box where a section heading stops, with a gap under its end plus the room kept for the next box (#1152, #1154)', () => {
    expect(REVEAL_SCROLL_MARGIN).toBe(
      `${SECTION_SCROLL_MARGIN} scroll-mb-[calc(--spacing(4)+var(${REVEAL_PEEK_VAR},0px))]`,
    )
  })
})
