import type { GroupField, UploadField } from 'payload'
import { describe, expect, it } from 'vitest'

import type { Media } from '@/payload-types'

import { bandBackdropField, toBandBackdrop } from './bandBackdrop'
import { imagesOnly } from './imagesOnly'

const photo = (id: number) =>
  ({ id, alt: `Photo ${id}`, url: `/api/media/file/${id}.jpg` }) as Media

describe('bandBackdropField', () => {
  const field = bandBackdropField() as GroupField & { name: string }

  it('is one group, `backdrop`, so a post and an event store the same shape', () => {
    expect(field.type).toBe('group')
    expect(field.name).toBe('backdrop')
  })

  it('holds one upload per screen size, in the order phone, tablet, desktop', () => {
    const uploads = field.fields as UploadField[]
    expect(uploads.map((upload) => upload.name)).toEqual(['phone', 'tablet', 'desktop'])
    for (const upload of uploads) {
      expect(upload.type).toBe('upload')
      expect(upload.relationTo).toBe('media')
    }
  })

  it('takes pictures only, never a video or a PDF', () => {
    for (const upload of field.fields as UploadField[]) {
      expect(upload.filterOptions).toBe(imagesOnly)
    }
  })

  it('is optional: an article with none keeps the plain band', () => {
    for (const upload of field.fields as UploadField[]) {
      expect(upload.required).toBeFalsy()
    }
  })

  it('tells the editor what each size shows and that a missing size uses the nearest crop', () => {
    const text = JSON.stringify(field.admin?.description) + JSON.stringify(field.fields)
    expect(text).toMatch(/nearest/i)
    expect(text).toMatch(/focal point/i)
  })
})

describe('toBandBackdrop', () => {
  it('maps each loaded crop', () => {
    const [phone, tablet, desktop] = [photo(1), photo(2), photo(3)]
    expect(toBandBackdrop({ phone, tablet, desktop })).toEqual({ phone, tablet, desktop })
  })

  it('has no backdrop when nothing is set or nothing is loaded', () => {
    expect(toBandBackdrop(null)).toBeNull()
    expect(toBandBackdrop(undefined)).toBeNull()
    expect(toBandBackdrop({ phone: null, tablet: null, desktop: null })).toBeNull()
    // Only ids: the field was not populated, which shows as no image
    expect(toBandBackdrop({ phone: 1, tablet: 2, desktop: 3 })).toBeNull()
  })

  it('keeps a crop that is loaded beside one that is not', () => {
    const desktop = photo(3)
    expect(toBandBackdrop({ phone: 1, desktop })).toEqual({
      phone: null,
      tablet: null,
      desktop,
    })
  })
})
