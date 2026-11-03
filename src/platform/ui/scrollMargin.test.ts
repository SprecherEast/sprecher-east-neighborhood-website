import { describe, expect, it } from 'vitest'

import { HEADER_SCROLL_MARGIN, SECTION_SCROLL_MARGIN } from './scrollMargin'

describe('scroll margins', () => {
  it('clear the header with one token, and the section bar too for article headings', () => {
    expect(HEADER_SCROLL_MARGIN).toBe('scroll-mt-[var(--header-clearance)]')
    expect(SECTION_SCROLL_MARGIN).toBe('scroll-mt-[var(--anchor-offset)]')
  })
})
