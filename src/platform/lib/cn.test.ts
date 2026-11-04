import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('cn', () => {
  it('lets a later class win over one it conflicts with', () => {
    expect(cn('p-4', 'p-6')).toBe('p-6')
    expect(cn('bg-chart-1', 'bg-chart-2')).toBe('bg-chart-2')
  })

  it('keeps bg-hatch beside a background colour: it is an image, not a colour (#662)', () => {
    expect(cn('bg-chart-2', 'bg-hatch')).toBe('bg-chart-2 bg-hatch')
  })
})
