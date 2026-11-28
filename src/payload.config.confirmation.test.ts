import type { CollectionConfig, PayloadRequest, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Where contact and verification meet (#183, decision 0008): the built config (no database)
 * must hand the confirmer to the contact form and contact's listener to the confirmations, and
 * the fields must accept what the contact form accepts.
 */

let config: SanitizedConfig
let submissions: CollectionConfig
let confirmations: CollectionConfig

beforeAll(async () => {
  config = await (await import('@payload-config')).default
  const find = (slug: string) => {
    const collection = config.collections.find((c) => c.slug === slug)
    if (!collection) throw new Error(`no ${slug}`)
    return collection as unknown as CollectionConfig
  }
  submissions = find('form-submissions')
  confirmations = find('email-confirmations')
}, 60_000)

type Validate = (value: unknown, options: unknown) => unknown
const fieldNamed = (collection: CollectionConfig, name: string) =>
  collection.fields.find((f) => 'name' in f && f.name === name) as
    { type: string; validate: Validate } | undefined

/** Runs a field's own validation, as Payload does before saving. */
const validate = (collection: CollectionConfig, name: string, value: string) =>
  fieldNamed(collection, name)?.validate(value, {
    collectionSlug: collection.slug,
    req: { payload: { collections: {}, config }, t: (key: string) => key },
    required: false,
  })

// Addresses the form and `parseEmailAddress` accept but Payload's email check refuses
const LOOSE_ADDRESSES = ['josé@example.com', 'ana@example.c']

describe('the contact form’s sender address', () => {
  it.each(LOOSE_ADDRESSES)('is stored for %s, so the message is never refused', (address) => {
    expect(fieldNamed(submissions, 'senderEmail')?.type).toBe('text')
    expect(validate(submissions, 'senderEmail', address)).toBe(true)
  })

  it.each(LOOSE_ADDRESSES)('gets no confirmation record for %s (no link goes out)', (address) => {
    expect(validate(confirmations, 'email', address)).not.toBe(true)
    expect(validate(confirmations, 'email', 'ana@example.com')).toBe(true)
  })
})

describe('composition', () => {
  it('hands the verification module’s confirmer to the contact form', async () => {
    const hooks = submissions.hooks?.beforeChange ?? []
    const recordSenderEmail = hooks[hooks.length - 1]
    const find = vi.fn(async () => ({ docs: [] }))
    const req = {
      headers: new Headers(),
      payload: {
        findByID: async () => ({ fields: [{ blockType: 'email', name: 'email' }] }),
        find,
        logger: { error: vi.fn(), warn: vi.fn() },
      },
    }
    const data = await recordSenderEmail?.({
      data: { form: 1, submissionData: [{ field: 'email', value: 'josé@example.com' }] },
      operation: 'create',
      req,
    } as never)
    expect(data).toMatchObject({ senderEmail: 'josé@example.com', emailConfirmed: false })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'email-confirmations' }),
    )
  })

  it('marks contact messages confirmed when a link is clicked', async () => {
    const endpoint = confirmations.endpoints ? confirmations.endpoints[0] : undefined
    const update = vi.fn(async () => ({ docs: [] }))
    const req = {
      headers: new Headers(),
      json: async () => ({ token: 'a'.repeat(43) }),
      payload: {
        find: async () => ({
          docs: [
            {
              id: 1,
              email: 'ana@example.com',
              confirmedAt: null,
              tokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
          ],
        }),
        delete: async () => ({ docs: [] }),
        db: { updateOne: async () => ({ id: 1 }) },
        update,
        sendEmail: vi.fn(async () => {}),
        logger: { error: vi.fn(), warn: vi.fn() },
      },
    } as unknown as PayloadRequest

    const response = await endpoint?.handler(req)

    expect(await response?.json()).toEqual({ outcome: 'confirmed', email: 'ana@example.com' })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'form-submissions',
        data: { emailConfirmed: true },
      }),
    )
  })
})
