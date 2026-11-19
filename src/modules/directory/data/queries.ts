import 'server-only'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { PUBLISHED } from '@/platform/payload/published'

import type { FaqEntry, ResourceSummary } from '../domain/types'

/** More entries than either page will hold for a long while; both pages list everything. */
const MAX_LIST_SIZE = 200

/** Every published FAQ entry, lowest `order` first. */
export async function findFaqEntries(): Promise<FaqEntry[]> {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'faq',
    // Depth 1 fills in the pages and posts an answer links to, so its links keep their address
    // (#227); only their slugs are read. A document the reader may not see stays an id, and the
    // renderer shows that link as plain text.
    depth: 1,
    populate: { pages: { slug: true }, posts: { slug: true } },
    limit: MAX_LIST_SIZE,
    sort: 'order',
    overrideAccess: false,
    where: PUBLISHED,
    select: { question: true, answer: true, category: true },
  })

  return result.docs
}

/** Every published resource, lowest `order` first. */
export async function findResources(): Promise<ResourceSummary[]> {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'resources',
    // Depth 1 loads an official's portrait (#393), with only what the card draws it from
    depth: 1,
    populate: {
      // `filename` lets Payload build `url`; `updatedAt` is the image's cache tag
      media: {
        alt: true,
        url: true,
        filename: true,
        width: true,
        height: true,
        mimeType: true,
        updatedAt: true,
      },
    },
    limit: MAX_LIST_SIZE,
    sort: 'order',
    overrideAccess: false,
    where: PUBLISHED,
    select: {
      title: true,
      description: true,
      url: true,
      phone: true,
      category: true,
      photo: true,
      photoCredit: true,
      photoSourceUrl: true,
      links: true,
    },
  })

  return result.docs
}
