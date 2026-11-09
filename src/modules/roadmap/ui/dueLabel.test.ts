import { describe, expect, it } from 'vitest'

import { dueLabel } from './dueLabel'

const NOW = new Date('2026-11-09T18:00:00Z')

describe('dueLabel', () => {
  it('says nothing without a due date', () => {
    expect(dueLabel(null, NOW, false)).toBeNull()
  })

  it('gives the date and how far away it is', () => {
    expect(dueLabel('2026-12-01T00:00:00.000Z', NOW, false)).toBe('Due Dec 1 · in 22 days')
    expect(dueLabel('2026-11-10T00:00:00.000Z', NOW, false)).toBe('Due Nov 10 · tomorrow')
    expect(dueLabel('2026-11-09T00:00:00.000Z', NOW, false)).toBe('Due today')
  })

  it('says a date has passed without scolding', () => {
    expect(dueLabel('2026-11-08T00:00:00.000Z', NOW, false)).toBe('Was due Nov 8 · yesterday')
    expect(dueLabel('2026-11-03T00:00:00.000Z', NOW, false)).toBe('Was due Nov 3 · 6 days ago')
  })

  it('gives only the date once the milestone is closed', () => {
    expect(dueLabel('2026-11-03T00:00:00.000Z', NOW, true)).toBe('Was due Nov 3')
  })
})
