import { describe, expect, it } from 'vitest'

import { toObjectPosition } from './focalPoint'

describe('toObjectPosition', () => {
  it('maps a focal point in percent to a CSS object-position', () => {
    expect(toObjectPosition({ focalX: 25, focalY: 75 })).toBe('25% 75%')
  })

  it('keeps the centre when no focal point is set', () => {
    expect(toObjectPosition({})).toBe('50% 50%')
    expect(toObjectPosition({ focalX: null, focalY: null })).toBe('50% 50%')
    expect(toObjectPosition(null)).toBe('50% 50%')
    expect(toObjectPosition(undefined)).toBe('50% 50%')
  })

  it('fills in the centre for the axis that is missing', () => {
    expect(toObjectPosition({ focalX: 10 })).toBe('10% 50%')
    expect(toObjectPosition({ focalY: 90 })).toBe('50% 90%')
  })

  it('keeps a value between 0 and 100 and ignores one that is not a number', () => {
    expect(toObjectPosition({ focalX: -5, focalY: 140 })).toBe('0% 100%')
    expect(toObjectPosition({ focalX: Number.NaN, focalY: 20 })).toBe('50% 20%')
  })
})
