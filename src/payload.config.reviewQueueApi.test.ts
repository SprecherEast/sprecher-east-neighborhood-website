import { GRAPHQL_POST, REST_POST } from '@payloadcms/next/routes'
import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  bootPayload,
  createAccount,
  NO_REVALIDATE,
  signIn,
} from '@/platform/payload/testing/inMemoryPayload'

/**
 * The review queue from outside (#123): a signed-in non-staff account can't publish an event over
 * REST or GraphQL, and Admin's Duplicate doesn't copy a suggestion's identity. Payload runs on an
 * in-memory SQLite database.
 */

let config: SanitizedConfig
let payload: Payload
let residentToken = ''

const source = { sourceName: 'City of Madison', sourceUrl: 'https://www.cityofmadison.com/e/2' }
const published = {
  title: 'Block party',
  slug: 'block-party',
  date: '2026-11-07T00:00:00.000Z',
  _status: 'published',
  ...source,
}

const post = (handler: typeof REST_POST, path: string[], body: unknown) =>
  handler(Promise.resolve(config))(
    new Request(`http://localhost:3000/api/${path.join('/')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${residentToken}` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: path }) },
  )

const stored = () =>
  payload.count({
    collection: 'events',
    where: { slug: { equals: 'block-party' } },
    overrideAccess: true,
  })

beforeAll(async () => {
  ;({ payload, config } = await bootPayload())
  residentToken = await signIn(payload, await createAccount(payload, 'resident', 'resident'))
}, 60_000)

describe('a resident publishing an event', () => {
  it('is refused over REST, and nothing is stored', async () => {
    const response = await post(REST_POST, ['events'], published)
    expect(response.status).toBe(403)
    expect((await stored()).totalDocs).toBe(0)
  })

  it('is refused over GraphQL, and nothing is stored', async () => {
    const mutation = `mutation { createEvent(data: {
      title: "Block party", slug: "block-party", date: "2026-11-07T00:00:00.000Z",
      _status: published, sourceName: "City", sourceUrl: "https://example.com/e"
    }) { id } }`
    const response = await post(GRAPHQL_POST as typeof REST_POST, ['graphql'], {
      query: mutation,
    })
    const body = (await response.json()) as { data?: { createEvent: unknown }; errors?: unknown[] }
    expect(JSON.stringify(body.errors)).toMatch(/not allowed/i)
    expect(body.data?.createEvent ?? null).toBeNull()
    expect((await stored()).totalDocs).toBe(0)
  })
})

describe('Admin’s Duplicate', () => {
  it('doesn’t copy a suggestion’s review status, source ID or fingerprint', async () => {
    const suggestion = await payload.create({
      collection: 'events',
      data: {
        ...published,
        _status: 'draft',
        slug: 'suggested',
        moderationStatus: 'suggested',
        externalId: 'city-7',
        contentHash: 'b'.repeat(64),
      },
      overrideAccess: true,
      context: NO_REVALIDATE,
    })
    const copy = await payload.duplicate({
      collection: 'events',
      id: suggestion.id,
      overrideAccess: true,
      context: NO_REVALIDATE,
    })
    expect(copy).toMatchObject({ moderationStatus: null, externalId: null, contentHash: null })
    expect(copy).toMatchObject(source)
  })
})
