// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { coloursWithText } from './chartAdapter.contract'

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')

describe('coloursWithText (the contract’s no-text-on-a-colour check)', () => {
  it('finds text on a coloured html mark and on a coloured svg mark', () => {
    expect(
      coloursWithText(parse('<span data-chart-mark class="bg-chart-1 block">x</span>')),
    ).toHaveLength(1)
    const svg = parse('<svg><text data-chart-mark class="fill-chart-2">Police</text></svg>')
    expect(coloursWithText(svg)).toHaveLength(1)
  })

  it('accepts empty coloured marks, and text marks that carry no colour', () => {
    expect(coloursWithText(parse('<span data-chart-mark class="bg-chart-1"></span>'))).toHaveLength(
      0,
    )
    expect(
      coloursWithText(parse('<svg><rect data-chart-mark class="fill-chart-3"/></svg>')),
    ).toHaveLength(0)
    expect(
      coloursWithText(parse('<li data-chart-mark class="font-semibold">Item: $1</li>')),
    ).toHaveLength(0)
  })
})
