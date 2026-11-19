import { describe, expect, it } from 'vitest'

import type { ImageRef } from '@/platform/lib'

import { checkPhotoCredit, checkResourceUrl, resourcePortrait } from './resourcePortrait'
import type { ResourceSummary } from './types'

const photo = { id: 3, alt: 'Placeholder', url: '/api/media/file/p.webp' } as ImageRef

const alder: ResourceSummary = {
  id: 1,
  title: 'Alder — District 16',
  category: 'elected-officials',
  photo,
  photoCredit: 'City of Madison, Alder Sean O’Brien',
  photoSourceUrl: null,
}

describe('checkResourceUrl', () => {
  it('accepts an empty value: the link is optional', () => {
    expect(checkResourceUrl(undefined)).toBe(true)
    expect(checkResourceUrl(null)).toBe(true)
    expect(checkResourceUrl('')).toBe(true)
  })

  it('accepts a web address', () => {
    expect(checkResourceUrl('https://www.cityofmadison.com/council/district16/blog')).toBe(true)
  })

  it('refuses anything else, with the same message as the website field', () => {
    expect(checkResourceUrl('javascript:alert(1)')).toBe(
      'Must be a valid URL starting with http:// or https://',
    )
    expect(checkResourceUrl('www.cityofmadison.com')).not.toBe(true)
  })
})

describe('checkPhotoCredit', () => {
  it('needs nothing when there is no photo', () => {
    expect(checkPhotoCredit(undefined, undefined)).toBe(true)
    expect(checkPhotoCredit('', null)).toBe(true)
  })

  it('requires a credit once a photo is set, whether as an id or a loaded image', () => {
    expect(checkPhotoCredit(undefined, 3)).toBe(
      'A photo needs a credit, for example "City of Madison".',
    )
    expect(checkPhotoCredit('   ', photo)).not.toBe(true)
    expect(checkPhotoCredit('City of Madison', 3)).toBe(true)
  })

  it('refuses a credit that starts with "Photo:", because the card adds it', () => {
    expect(checkPhotoCredit('Photo: City of Madison', 3)).toBe(
      'Leave out "Photo:": the card adds it.',
    )
    expect(checkPhotoCredit('photo:City of Madison', 3)).not.toBe(true)
  })
})

describe('resourcePortrait', () => {
  it('gives an elected official’s photo, named after them, with the card’s credit and source', () => {
    expect(resourcePortrait({ ...alder, photoSourceUrl: 'https://example.com/a' })).toEqual({
      ...photo,
      alt: 'Alder — District 16',
      credit: 'City of Madison, Alder Sean O’Brien',
      sourceUrl: 'https://example.com/a',
      license: null,
      licenseUrl: null,
    })
  })

  it('uses the resource’s credit, not one stored on the media item', () => {
    const credited = { ...photo, credit: 'Someone else', license: 'cc-by' } as ImageRef
    const portrait = resourcePortrait({ ...alder, photo: credited })
    expect(portrait?.credit).toBe('City of Madison, Alder Sean O’Brien')
    expect(portrait?.license).toBeNull()
  })

  it('shows no photo without a loaded image or a credit', () => {
    expect(resourcePortrait({ ...alder, photo: null })).toBeNull()
    expect(resourcePortrait({ ...alder, photo: 3 })).toBeNull()
    expect(resourcePortrait({ ...alder, photoCredit: '  ' })).toBeNull()
    expect(resourcePortrait({ id: 2, title: 'Library', category: 'community' })).toBeNull()
  })

  it('shows no photo on a resource that is not an elected official', () => {
    // The field is hidden for other categories, but a photo set before the category changed stays
    expect(resourcePortrait({ ...alder, category: 'community' })).toBeNull()
  })

  it('drops a source link that is not a web address', () => {
    expect(resourcePortrait({ ...alder, photoSourceUrl: 'javascript:alert(1)' })?.sourceUrl).toBe(
      null,
    )
  })
})
