import { describe, expect, it } from 'vitest'

import { parseIssueNumber, parseMissionNumber, planIssuePath, planMissionPath } from './paths'

describe('parseIssueNumber', () => {
  it('reads plain digits and nothing else', () => {
    expect(parseIssueNumber('12')).toBe(12)
    for (const bad of ['0', '012', '1e3', '-4', 'abc', '1.5', '', '1234567890']) {
      expect(parseIssueNumber(bad)).toBeUndefined()
    }
  })

  it('is the reverse of an issue path', () => {
    expect(parseIssueNumber(planIssuePath(7).split('/').pop() ?? '')).toBe(7)
  })
})

describe('mission addresses', () => {
  it('puts a mission under the plan, by its milestone number', () => {
    expect(planMissionPath(5)).toBe('/roadmap/missions/5')
  })

  it('reads plain digits only, like issue numbers, and is the reverse of the path', () => {
    expect(parseMissionNumber('5')).toBe(5)
    for (const bad of ['0', '05', '5a', '', '1234567890']) {
      expect(parseMissionNumber(bad)).toBeUndefined()
    }
    expect(parseMissionNumber(planMissionPath(9).split('/').pop() ?? '')).toBe(9)
  })
})
