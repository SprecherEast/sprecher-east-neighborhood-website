import { describe, expect, it } from 'vitest'

import { BARS, PROPS } from './billShareFixtures'
import { fillFigures, figuresFor, initialFigures, splitBillPanel } from './billFigures'
import type { FactTabPanelItem } from './factTabs'

const bars: FactTabPanelItem = { kind: 'chart', spec: BARS, enlarge: false }
const bill: FactTabPanelItem = { kind: 'billShare', billShare: PROPS }

describe('fillFigures', () => {
  it('writes the City’s extra tax in a year and in a month where the editor put the placeholders', () => {
    const figures = figuresFor(90.04)
    expect(fillFigures('+{yearly} a year', figures)).toBe('+$90 a year')
    expect(fillFigures('Your share: about {monthly} more a month', figures)).toBe(
      'Your share: about $7.50 more a month',
    )
  })

  it('leaves text without a placeholder as written, and any text when there are no figures', () => {
    expect(fillFigures('One average home', figuresFor(90))).toBe('One average home')
    expect(fillFigures('+{yearly} a year', undefined)).toBe('+{yearly} a year')
  })
})

describe('splitBillPanel', () => {
  it('finds the bill and, only with a bill, the City’s bar chart', () => {
    expect(splitBillPanel([bill, bars]).cityBars).toBe(BARS)
    expect(splitBillPanel([bars]).bill).toBeUndefined()
    expect(splitBillPanel([bars]).cityBars).toBeUndefined()
  })
})

describe('initialFigures', () => {
  it('is the average home’s increase in the last year, and none for a tab without a bill', () => {
    expect(initialFigures([bill, bars])).toEqual(figuresFor(90))
    expect(initialFigures([bars])).toBeUndefined()
    expect(initialFigures([bill])).toBeUndefined()
  })
})
