import { describe, expect, it } from 'vitest'

import { DEFAULT_BILL_TOASTS } from './billShareDefaults'
import { toastsOf } from './billToasts'

describe('toastsOf (#1379)', () => {
  it('gives every toast its starting wording while the block has none of its own', () => {
    const toasts = toastsOf(undefined)
    expect(toasts.ratesCarried).toMatchObject({
      tone: 'warning',
      placement: 'panel',
      showsPerVisit: 2,
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
      showsPerVisit: 2,
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

  it('holds how many times a toast shows in a visit to 1 to 10, and falls back to the starting two', () => {
    const shows = (value: unknown) =>
      toastsOf([{ toast: 'ratesOwn', message: 'Hi', showsPerVisit: value as number }]).ratesOwn
        ?.showsPerVisit
    expect(shows(3)).toBe(3)
    expect(shows(0)).toBe(1)
    expect(shows(99)).toBe(10)
    expect(shows(undefined)).toBe(2)
  })

  it('starts with a warning for each panel’s Estimate button, each short and each inside its own panel', () => {
    const toasts = toastsOf(undefined)
    for (const id of ['aboutAnswer', 'aboutRates', 'aboutBill'] as const) {
      expect(toasts[id]).toMatchObject({ tone: 'warning', ending: 'accept', placement: 'panel' })
      expect(toasts[id]?.message.split(/\s+/).length).toBeLessThanOrEqual(20)
    }
  })

  it('says in the starting carried-rates warning which year’s rates stand in for the missing ones', () => {
    expect(toastsOf(undefined).ratesCarried?.message).toContain('{carried}')
  })
})
