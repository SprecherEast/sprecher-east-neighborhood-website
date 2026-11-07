import { describe, expect, it } from 'vitest'

import { resourceItems } from './resources'

const byTitle = (pattern: RegExp) => resourceItems.find((item) => pattern.test(item.title))

describe('seeded resources: facts a neighbor relies on', () => {
  it('names the county supervisor for District 16, not another district', () => {
    const county = byTitle(/Dane County/)

    expect(county?.title).toContain('District 16')
    expect(county?.title).toContain('Obieze')
    expect(county?.url).toBe('https://board.danecounty.gov/Supervisors/Detail/16')
    expect(resourceItems.some((item) => /District 37/.test(item.title))).toBe(false)
  })

  it('tells neighbors county districts are not the same as alder districts', () => {
    expect(byTitle(/Dane County/)?.description).toMatch(/separate from Madison.s alder districts/)
  })

  it('uses the phone numbers the city lists', () => {
    expect(byTitle(/Elvehjem Elementary/)?.phone).toBe('(608) 204-1400')
    expect(byTitle(/East District/)?.phone).toBe('(608) 266-4887')
  })

  it('lists no old county board address', () => {
    const hosts = resourceItems.flatMap((item) => (item.url ? [new URL(item.url).hostname] : []))

    expect(hosts).not.toContain('board.countyofdane.com')
  })
})
