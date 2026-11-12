import { describe, expect, it } from 'vitest'

import { activityLabel, recentWords } from './activityWords'

describe('recentWords', () => {
  it('says how many were finished in the newest step', () => {
    expect(recentWords([0, 2, 3], 5, 'weeks')).toBe('3 finished this week')
    expect(recentWords([0, 2, 1], 3, 'months')).toBe('1 finished this month')
    expect(recentWords([4, 6], 10, 'years')).toBe('6 finished this year')
  })

  it('says it is quiet when the newest step has nothing', () => {
    expect(recentWords([2, 0], 2, 'weeks')).toBe('Quiet this week')
  })

  it('says nothing is finished when the mission has nothing done at all', () => {
    expect(recentWords([0, 0], 0, 'weeks')).toBe('Nothing finished yet')
  })
})

describe('activityLabel', () => {
  it('lists every value, oldest first, for screen readers', () => {
    expect(activityLabel([0, 1, 4], 'weeks')).toBe('Finished each week, oldest first: 0, 1, 4')
    expect(activityLabel([2], 'years')).toBe('Finished each year, oldest first: 2')
  })
})
