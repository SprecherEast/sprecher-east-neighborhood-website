import { describe, expect, it } from 'vitest'

import { toggleDay } from './toggleDay'

describe('toggleDay', () => {
  it('adds a day, keeping the days oldest first', () => {
    expect(toggleDay(['2026-11-13'], '2026-11-12')).toEqual(['2026-11-12', '2026-11-13'])
  })

  it('takes a day that is there out and leaves the rest', () => {
    expect(toggleDay(['2026-11-12', '2026-11-13'], '2026-11-13')).toEqual(['2026-11-12'])
  })
})
