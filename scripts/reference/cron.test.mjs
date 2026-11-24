import { describe, expect, it } from 'vitest'

import { describeCron } from './jobs.mjs'

describe('describeCron', () => {
  it('says the simple patterns in words', () => {
    expect(describeCron('* * * * *')).toBe('every minute')
    expect(describeCron('*/10 * * * *')).toBe('every 10 minutes')
    expect(describeCron('0 * * * *')).toBe('every hour, on the hour')
    expect(describeCron('15 * * * *')).toBe('every hour at minute 15')
    expect(describeCron('17 7 * * *')).toBe('every day at 07:17')
  })

  it('gives nothing for a pattern it does not read, so the expression stands alone', () => {
    expect(describeCron('0 6 * * 1-5')).toBe('')
    // a fixed hour is not "every minute", and not "every 10 minutes"
    expect(describeCron('* 5 * * *')).toBe('')
    expect(describeCron('*/10 5 * * *')).toBe('')
  })
})
