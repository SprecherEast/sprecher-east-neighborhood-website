import { describe, expect, it } from 'vitest'

import { heroPhotoVars } from './heroGeometry'

describe('heroPhotoVars', () => {
  it("gives the photo's width-to-height ratio and the focal point's height as a fraction", () => {
    expect(heroPhotoVars({ width: 1920, height: 1080, focalY: 32.6 })).toEqual({
      '--hero-aspect': '1.7778',
      '--hero-focal-y': '0.326',
    })
  })

  it('puts the horizon in the middle of a photo with no focal point', () => {
    expect(heroPhotoVars({ width: 1000, height: 500 })['--hero-focal-y']).toBe('0.5')
  })

  it('keeps the focal point within the photo', () => {
    expect(heroPhotoVars({ width: 1, height: 1, focalY: 140 })['--hero-focal-y']).toBe('1')
    expect(heroPhotoVars({ width: 1, height: 1, focalY: -5 })['--hero-focal-y']).toBe('0')
  })

  it('takes a widescreen ratio when the upload has no size', () => {
    expect(heroPhotoVars({ width: null, height: 0 })['--hero-aspect']).toBe('1.7778')
  })

  it('has no horizon without a photo, so the hero is only as tall as its text', () => {
    expect(heroPhotoVars(undefined)).toEqual({ '--hero-aspect': '1.7778', '--hero-focal-y': '0' })
  })
})
