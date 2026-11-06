import { describe, expect, it } from 'vitest'

import { describeSettings, describeVersions } from './settings.mjs'

describe('describeVersions', () => {
  it('says there are no drafts when versions are off', () => {
    expect(describeVersions(undefined)).toEqual(['Drafts: no', 'Versions: none kept'])
  })

  it('describes drafts, autosave, scheduled publishing and the version limit', () => {
    expect(
      describeVersions({
        drafts: { autosave: { interval: 100 }, schedulePublish: true, validate: false },
        maxPerDoc: 25,
      }),
    ).toEqual([
      'Drafts: yes (autosave every 100 ms, scheduled publishing)',
      'Versions: the last 25 of each document',
    ])
  })

  it('says plain drafts when autosave is off', () => {
    expect(describeVersions({ drafts: { autosave: false }, maxPerDoc: 100 })[0]).toBe(
      'Drafts: yes (no autosave)',
    )
  })
})

describe('describeSettings', () => {
  it('lists scalars sorted, functions by name and nested objects with a dotted name', () => {
    function brand() {}
    expect(
      describeSettings({ tokenExpiration: 7200, cookies: { secure: true }, email: brand }),
    ).toEqual([
      ['cookies.secure', 'true'],
      ['email', 'brand'],
      ['tokenExpiration', '7200'],
    ])
  })

  it('leaves out empty lists and the values Payload sets when nobody chose one', () => {
    expect(
      describeSettings({
        strategies: [],
        loginWithUsername: false,
        useSessions: true,
        cookies: { sameSite: 'Lax', secure: true },
        forgotPassword: { minRequestInterval: 15000, expiration: 3600000 },
        maxLoginAttempts: 10,
      }),
    ).toEqual([
      ['cookies.secure', 'true'],
      ['forgotPassword.expiration', '3600000'],
      ['maxLoginAttempts', '10'],
    ])
  })

  it('lists image sizes by name and dimensions', () => {
    const imageSizes = [
      { name: 'thumb', width: 300 },
      { name: 'og', width: 1200, height: 630 },
    ]
    expect(describeSettings({ imageSizes })).toEqual([
      ['imageSizes', 'thumb 300xauto, og 1200x630'],
    ])
  })

  it('makes a path under the root relative, and leaves a sibling folder alone', () => {
    const settings = { staticDir: '/work/repo/public/media', other: '/work/repo-other/x' }
    expect(describeSettings(settings, { root: '/work/repo' })).toEqual([
      ['other', '/work/repo-other/x'],
      ['staticDir', 'public/media'],
    ])
  })
})
