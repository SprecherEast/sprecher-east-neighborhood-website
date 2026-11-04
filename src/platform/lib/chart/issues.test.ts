import { describe, expect, it } from 'vitest'

import { FIXTURES } from './fixtures'
import { chartIssues } from './issues'

describe('chartIssues', () => {
  it('finds nothing wrong with a valid chart', () => {
    expect(chartIssues(FIXTURES.bars)).toEqual([])
  })

  it('names each problem with the path it is about and a plain sentence', () => {
    const issues = chartIssues({ ...FIXTURES.bars, title: '', unit: 'euros' })
    expect(issues.map((i) => i.path[0]).sort()).toEqual(['title', 'unit'])
    expect(issues.every((i) => i.message.length > 0 && !i.message.includes('Zod'))).toBe(true)
  })

  it('reports a rule across the chart (a bar past the scale) at the field it is about', () => {
    const issues = chartIssues({ ...FIXTURES.bars, scaleMax: 1 })
    expect(issues).toEqual([{ path: ['scaleMax'], message: expect.stringMatching(/scaleMax/) }])
  })

  it('reports an unknown kind', () => {
    expect(chartIssues({ kind: 'pie' })[0].path).toEqual(['kind'])
  })
})
