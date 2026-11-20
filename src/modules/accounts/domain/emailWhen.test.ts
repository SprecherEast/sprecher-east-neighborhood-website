import { describe, expect, it } from 'vitest'

import { toEmailWhen } from './emailWhen'

describe('toEmailWhen', () => {
  it('writes the moment in the site’s time zone, standard and daylight time', () => {
    expect(toEmailWhen(new Date('2026-11-19T23:05:00.000Z'))).toBe('Nov 19, 2026, 5:05 PM CST')
    expect(toEmailWhen(new Date('2026-07-04T17:30:00.000Z'))).toBe('Jul 4, 2026, 12:30 PM CDT')
  })
})
