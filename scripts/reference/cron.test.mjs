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

  it('says a weekly schedule with the day of the week', () => {
    expect(describeCron('30 9 * * 0')).toBe('every Sunday at 09:30')
    expect(describeCron('0 6 * * 1')).toBe('every Monday at 06:00')
    expect(describeCron('5 18 * * 6')).toBe('every Saturday at 18:05')
    expect(describeCron('30 9 * * 7')).toBe('every Sunday at 09:30')
    expect(describeCron('30 9 * * 8')).toBe('')
    expect(describeCron('30 * * * 0')).toBe('')
    expect(describeCron('30 9 1 * 0')).toBe('')
  })

  it('reads spaces around and between the fields, and numbers of any length', () => {
    expect(describeCron('  0 6 * * *  ')).toBe('every day at 06:00')
    expect(describeCron('0   6 *  * *')).toBe('every day at 06:00')
    expect(describeCron('45 14 * * *')).toBe('every day at 14:45')
    expect(describeCron('*/15 * * * *')).toBe('every 15 minutes')
    expect(describeCron('10 * * * *')).toBe('every hour at minute 10')
  })

  it('reads a number or a step only when it is nothing else', () => {
    expect(describeCron('*/5x * * * *')).toBe('')
    expect(describeCron('x*/5 * * * *')).toBe('')
    expect(describeCron('5x * * * *')).toBe('')
    expect(describeCron('x5 * * * *')).toBe('')
    expect(describeCron('0 6x * * *')).toBe('')
    expect(describeCron('0 x6 * * *')).toBe('')
  })

  it('gives nothing for a pattern it does not read, so the expression stands alone', () => {
    expect(describeCron('0 6 * * 1-5')).toBe('')
    // a fixed hour is not "every minute", and not "every 10 minutes"
    expect(describeCron('* 5 * * *')).toBe('')
    expect(describeCron('*/10 5 * * *')).toBe('')
    // a range or a step in the hour is not one fixed time of day
    expect(describeCron('0 */2 * * *')).toBe('')
    expect(describeCron('0 1-5 * * *')).toBe('')
  })
})
