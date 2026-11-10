import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { aboutPage } from './about-page'
import { getInvolvedPage } from './get-involved-page'
import { privacyPage } from './privacy-page'
import { eventItems } from './data/events'

// The seed puts the same words on a fresh site that the live CMS holds (#1010), and no page
// claims to be, or to speak for, a neighborhood association. The draft association page and the
// placeholder board positions in index.ts are left for the owner.
const files = [
  'home.ts',
  'home-static.ts',
  'post-1.ts',
  'post-2.ts',
  'post-3.ts',
  'contact-form.ts',
  'data/resources.ts',
  'get-involved-page.ts',
  'about-page.ts',
  'privacy-page.ts',
  'data/faq.ts',
  'data/events.ts',
]
const read = (file: string) => readFileSync(path.resolve(__dirname, file), 'utf8')

describe('seed copy makes no association claims (#1010)', () => {
  it.each(files)('%s claims no initiative, association or membership', (file) => {
    const source = read(file)
    expect(source).not.toMatch(/grassroots|neighborhood initiative|Neighborhood Association\b/)
    expect(source).not.toMatch(/Free membership|Membership is|Membership in/)
  })

  it.each(files)(
    '%s has no founding year, membership option, board or registration claim',
    (file) => {
      const source = read(file)
      expect(source).not.toMatch(/since 20\d\d|Established \d{4}|a community since/i)
      expect(source).not.toMatch(/label: 'Membership'|Board \/ Association|label: 'Board/)
      expect(source).not.toMatch(/not official yet|registration with the City/i)
      expect(source).not.toMatch(/come to a meeting|our meetings/i)
    },
  )

  it.each(files)('%s says "neighbors", not "residents"', (file) => {
    expect(read(file)).not.toMatch(/\bresidents?\b/i)
  })

  it('writes the Home description once, for the full and the static Home page', () => {
    expect(read('home.ts')).toContain('HOME_DESCRIPTION')
    expect(read('home-static.ts')).toContain('HOME_DESCRIPTION')
    expect(read('home.ts') + read('home-static.ts')).not.toContain('An unofficial site.')
  })

  it('points the source-code link at the SprecherEast organization', () => {
    for (const file of ['index.ts', '../../../scripts/measure-ui-gate.mjs']) {
      const source = read(file)
      expect(source).toContain('SprecherEast/sprecher-east-neighborhood-website')
      expect(source).not.toContain('boulaajaj/sprecher-east-neighborhood-website')
    }
  })

  it('shows no link to the draft association page in the footer', () => {
    expect(read('index.ts')).not.toContain("url: '/association'")
  })
})

describe('seed pages match the live wording (#1010)', () => {
  it('describes Get Involved without membership or dues', () => {
    expect(getInvolvedPage().meta?.description).toBe(
      'Ways to help this unofficial Sprecher East site: tell us what you need, point out what’s wrong, and pass it on.',
    )
  })

  it('words the privacy page without a stray symbol or a broken sentence', () => {
    const json = JSON.stringify(privacyPage())
    expect(json).toContain('ignores anything after a question mark in a page address')
    expect(json).not.toContain('after a ? in')
    expect(json).toContain('A click like that is probably a person, though we can’t be certain.')
    expect(json).not.toContain('That is a likely person')
  })

  it('has no link to a post that no longer exists, and the live closing line', () => {
    const json = JSON.stringify(aboutPage())
    expect(json).not.toContain('sprecher-east-is-coming-together')
    expect(json).not.toContain('forming a neighborhood association')
    expect(json).toContain('Please tell us and we’ll fix it.')
  })

  it('does not place the police training center inside the neighborhood', () => {
    const event = eventItems.find((item) => item.slug === 'mpd-recognition-2026-04-22')
    expect(event?.title).toBe('MPD Recognition Event')
    expect(event?.description).toBe(
      'The Madison Police Department holds a recognition event at its Training Center on Femrite Drive. It’s open to the public.',
    )
  })
})
