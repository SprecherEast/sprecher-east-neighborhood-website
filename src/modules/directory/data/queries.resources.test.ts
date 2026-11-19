import type { Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootPayload, NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'

import type * as Queries from './queries'

/**
 * An official's portrait and extra links on a resource (#393), saved through the real collection
 * and read back as the resources page reads them. Payload runs on in-memory SQLite.
 */

let payload: Payload
let queries: typeof Queries

const uploadMedia = async (name: string, mimetype: string, data: Buffer) =>
  payload.create({
    collection: 'media',
    data: { alt: name },
    file: { name, data, mimetype, size: data.byteLength },
    overrideAccess: true,
  })

const resource = (data: Record<string, unknown>) =>
  payload.create({
    collection: 'resources',
    data: { title: 'Alder', category: 'elected-officials', _status: 'published', ...data },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })

/** The field errors Payload refuses a save with, or [] when it saves */
async function errorsOf(data: Record<string, unknown>): Promise<string[]> {
  try {
    await resource(data)
    return []
  } catch (error) {
    const { data: details } = error as { data?: { errors?: { path: string }[] } }
    return details?.errors?.map(({ path }) => path) ?? [String(error)]
  }
}

let image: number
let pdf: number

// Uploads land in public/media (gitignored); remove this file's own afterwards
afterAll(async () => {
  await payload.delete({
    collection: 'media',
    where: { filename: { like: 'resources-test-' } },
    overrideAccess: true,
  })
})

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  queries = await import('./queries')
  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer()
  image = (await uploadMedia('resources-test-portrait.png', 'image/png', png)).id
  pdf = (await uploadMedia('resources-test-flyer.pdf', 'application/pdf', Buffer.from('%PDF-1.4\n%%EOF\n'))).id
})

describe('the resources collection (#393)', () => {
  it('refuses a link row without a URL, or with one that is not a web address', async () => {
    expect(await errorsOf({ links: [{ label: 'Blog' }] })).toEqual(['links.0.url'])
    expect(await errorsOf({ links: [{ label: 'Blog', url: '' }] })).toEqual(['links.0.url'])
    expect(await errorsOf({ links: [{ label: 'Blog', url: 'javascript:alert(1)' }] })).toEqual([
      'links.0.url',
    ])
    expect(await errorsOf({ links: [{ label: 'Blog', url: 'https://example.com/blog' }] })).toEqual(
      [],
    )
  })

  it('takes only an image as the portrait', async () => {
    expect(await errorsOf({ photo: pdf, photoCredit: 'Someone' })).toEqual(['photo'])
    expect(await errorsOf({ photo: image, photoCredit: 'Someone' })).toEqual([])
  })

  it('needs a credit with a photo, but no source link', async () => {
    expect(await errorsOf({ photo: image })).toEqual(['photoCredit'])
  })

  it('keeps each text field’s length limit alongside its own check', async () => {
    const long = `https://example.com/${'a'.repeat(2048)}`
    expect(await errorsOf({ photo: image, photoCredit: 'x'.repeat(201) })).toEqual(['photoCredit'])
    expect(await errorsOf({ photoSourceUrl: long })).toEqual(['photoSourceUrl'])
    expect(await errorsOf({ links: [{ label: 'Blog', url: long }] })).toEqual(['links.0.url'])
  })

  it('still lets an editor delete a photo a resource and its versions use', async () => {
    const extra = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 9, g: 9, b: 9 } },
    })
      .png()
      .toBuffer()
    const photo = (await uploadMedia('resources-test-old.png', 'image/png', extra)).id
    const doc = await resource({ title: 'Mayor', photo, photoCredit: 'City' })

    await payload.delete({ collection: 'media', id: photo, overrideAccess: true })

    const after = await payload.findByID({
      collection: 'resources',
      id: doc.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(after.photo ?? null).toBeNull()
  })
})

describe('findResources (#393)', () => {
  it('returns the portrait loaded and the extra links', async () => {
    await resource({
      title: 'Alder with photo',
      photo: image,
      photoCredit: 'City of Madison',
      links: [{ label: 'Alder blog', url: 'https://example.com/blog' }],
    })

    const found = (await queries.findResources()).find(({ title }) => title === 'Alder with photo')

    expect(found?.photoCredit).toBe('City of Madison')
    expect(found?.links?.map(({ label, url }) => ({ label, url }))).toEqual([
      { label: 'Alder blog', url: 'https://example.com/blog' },
    ])
    expect(typeof found?.photo === 'object' && found.photo?.url).toMatch(/resources-test-portrait\.png/)
  })
})
