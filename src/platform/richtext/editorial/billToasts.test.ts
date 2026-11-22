import { describe, expect, it } from 'vitest'

import { DEFAULT_BILL_TOASTS } from './billShareDefaults'
import { toastsOf } from './billToasts'

describe('toastsOf (#1379)', () => {
  it('gives every toast its starting wording while the block has none of its own', () => {
    const toasts = toastsOf(undefined)
    expect(toasts.ratesCarried).toMatchObject({
      tone: 'warning',
      placement: 'panel',
      message: DEFAULT_BILL_TOASTS.ratesCarried.message,
      ending: 'accept',
      acceptLabel: 'Got it',
    })
    // A year whose rates are all its own starts with no notice (#1392)
    expect(toasts.ratesOwn).toBeNull()
  })

  it('uses what the editor wrote for a toast, and the seconds as milliseconds', () => {
    const toasts = toastsOf([
      {
        toast: 'ratesOwn',
        tone: 'warning',
        title: ' Heads up ',
        message: ' Using {year}. ',
        ending: 'fade',
        fadeSeconds: 8,
        acceptLabel: 'OK',
      },
    ])
    expect(toasts.ratesOwn).toEqual({
      tone: 'warning',
      title: 'Heads up',
      message: 'Using {year}.',
      ending: 'fade',
      durationMs: 8000,
      acceptLabel: 'OK',
      placement: 'panel',
    })
  })

  it('turns a toast off when its message is empty, or when its row was taken out of the list', () => {
    const toasts = toastsOf([
      { toast: 'ratesOwn', tone: 'info', ending: 'accept', message: '   ' },
      // no row for ratesCarried
    ])
    expect(toasts.ratesOwn).toBeNull()
    expect(toasts.ratesCarried).toBeNull()
  })

  it('gives an Estimate-button toast its starting wording when a saved list never had its row (a block saved before it existed)', () => {
    const saved = toastsOf([
      { toast: 'ratesCarried', tone: 'warning', ending: 'accept', message: 'Carried.' },
    ])
    expect(saved.aboutAnswer?.message).toMatch(/average Madison home/)
    expect(saved.aboutBill?.message).toMatch(/state credits/)
    expect(saved.aboutRates?.message).toBeTruthy()
    // a row the editor kept but emptied is still off
    const emptied = toastsOf([{ toast: 'aboutBill', message: ' ' }])
    expect(emptied.aboutBill).toBeNull()
    expect(emptied.aboutAnswer).not.toBeNull()
  })

  it('falls back to a kind, an ending, a time and a button label that make sense', () => {
    const toasts = toastsOf([
      { toast: 'ratesOwn', tone: 'loud', ending: 'sometimes', message: 'Hi', fadeSeconds: 500 },
    ])
    expect(toasts.ratesOwn).toMatchObject({ tone: 'info', ending: 'accept', acceptLabel: 'Got it' })
    // A fade time outside the allowed range is held to it
    const fading = toastsOf([
      { toast: 'ratesOwn', ending: 'fade', message: 'Hi', fadeSeconds: 500 },
    ])
    expect(fading.ratesOwn?.durationMs).toBe(60_000)
    const quick = toastsOf([{ toast: 'ratesOwn', ending: 'fade', message: 'Hi', fadeSeconds: 0 }])
    expect(quick.ratesOwn?.durationMs).toBe(1000)
  })

  it('ignores a row for a toast the code does not know', () => {
    const toasts = toastsOf([{ toast: 'mystery', message: 'Hi' }])
    expect(Object.keys(toasts).sort()).toEqual([
      'aboutAnswer',
      'aboutBill',
      'aboutRates',
      'ratesCarried',
      'ratesOwn',
    ])
  })

  it('puts a toast inside its panel unless the editor set it elsewhere, and falls back to the panel', () => {
    const toasts = toastsOf([
      { toast: 'ratesCarried', message: 'Hi', placement: 'screen' },
      { toast: 'ratesOwn', message: 'Hi', placement: 'sideways' },
    ])
    expect(toasts.ratesCarried?.placement).toBe('screen')
    expect(toasts.ratesOwn?.placement).toBe('panel')
    expect(toastsOf(undefined).ratesCarried?.placement).toBe('panel')
    expect(
      toastsOf([{ toast: 'ratesOwn', message: 'Hi', placement: 'above' }]).ratesOwn?.placement,
    ).toBe('above')
  })

  it('keeps the note the rates panel had, as the carried-rates toast, in a block that never saved its toasts (#1380)', () => {
    expect(toastsOf(undefined, 'Wait for {year}.').ratesCarried?.message).toBe('Wait for {year}.')
    expect(toastsOf(undefined, 'Wait for {year}.').ratesOwn).toBeNull()
  })

  it('turns the carried-rates toast off when the editor had emptied that note, and ignores it once the toasts are saved', () => {
    expect(toastsOf(undefined, '  ').ratesCarried).toBeNull()
    const saved = toastsOf([{ toast: 'ratesCarried', message: 'Saved words' }], 'Old note')
    expect(saved.ratesCarried?.message).toBe('Saved words')
  })

  it('starts with a warning for each panel’s Estimate button, each short and each inside its own panel', () => {
    const toasts = toastsOf(undefined)
    for (const id of ['aboutAnswer', 'aboutRates', 'aboutBill'] as const) {
      expect(toasts[id]).toMatchObject({ tone: 'warning', ending: 'accept', placement: 'panel' })
      expect(toasts[id]?.message.split(/\s+/).length).toBeLessThanOrEqual(30)
    }
  })

  it('says in the starting carried-rates warning which year’s rates stand in for the missing ones', () => {
    expect(toastsOf(undefined).ratesCarried?.message).toContain('{carried}')
  })
})
