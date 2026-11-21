import { getPayload, type Payload, type SanitizedConfig } from 'payload'
import { vi } from 'vitest'

import { exportPreviewCopy } from '../previewCopy/exportContent'
import { bootPayload, createAccount, NO_REVALIDATE, paragraph } from './inMemoryPayload'

/**
 * A "production" database for the preview copy tests (#1396): published content, and everything
 * that must stay behind (drafts, an unpublished document, accounts, a submission, recipients),
 * already exported as a visitor.
 */

export const SECRET_EMAIL = 'private.person@example.org'
export const STAFF_EMAIL = 'ana@example.com'
export const RECIPIENT = 'board-recipient@example.org'
export const asStaff = { overrideAccess: true, context: NO_REVALIDATE } as const
const as = asStaff
const published = { _status: 'published' as const }

/** A second Payload on its own fresh in-memory database (libsql opens one per instance). */
export async function freshPayload(config: SanitizedConfig, key: string): Promise<Payload> {
  // Payload pushes the schema once per process unless told to, and a new database needs it
  vi.stubEnv('PAYLOAD_FORCE_DRIZZLE_PUSH', 'true')
  return getPayload({ config, key })
}

/** A picture's record without an upload: the export reads records, the server step links the files. */
async function media(production: Payload, name: string, alt: string): Promise<number> {
  const doc = await production.db.create({
    collection: 'media',
    data: {
      alt,
      filename: `${name}.jpg`,
      mimeType: 'image/jpeg',
      filesize: 10,
      width: 4,
      height: 3,
      sizes: { thumbnail: { filename: `${name}-300.jpg`, width: 3, height: 2 } },
    } as never,
  })
  return doc.id as number
}

const figure = (image: number) => ({
  type: 'block',
  version: 2,
  format: '',
  fields: { id: `f${image}`, blockType: 'figure', image, title: 'A figure' },
})
const rich = (...extra: (Record<string, unknown> & { type: string; version: number })[]) => {
  const base = paragraph('Body text')
  return { root: { ...base.root, children: [...base.root.children, ...extra] } }
}

export async function seedAndExport() {
  const { payload: production, config } = await bootPayload()
  const ids: Record<string, number> = {}
  const admin = await createAccount(production, 'admin', 'ana')

  ids.heroMedia = await media(production, 'hero', 'Hero picture')
  ids.figureMedia = await media(production, 'figure', 'Figure picture')
  ids.draftOnlyMedia = await media(production, 'draft-only', 'Only a draft uses this')
  ids.unusedMedia = await media(production, 'unused', 'Nobody uses this')

  const parent = await production.create({
    collection: 'categories',
    data: { title: 'Parent', slug: 'parent' },
    ...as,
  })
  const child = await production.create({
    collection: 'categories',
    data: { title: 'Child', slug: 'child', parent: parent.id },
    ...as,
  })
  ids.parent = parent.id
  ids.child = child.id

  const related = await production.create({
    collection: 'posts',
    data: { title: 'Related', slug: 'related', content: paragraph('r'), ...published },
    ...as,
  })
  const draftPost = await production.create({
    collection: 'posts',
    data: {
      title: 'Never published',
      slug: 'never',
      content: rich(figure(ids.draftOnlyMedia)),
      heroImage: ids.draftOnlyMedia,
    },
    ...as,
  })
  const post = await production.create({
    collection: 'posts',
    data: {
      title: 'Published title',
      slug: 'main-post',
      authors: [admin.id],
      heroImage: ids.heroMedia,
      categories: [child.id],
      content: rich(figure(ids.figureMedia), {
        type: 'paragraph',
        version: 1,
        children: [
          {
            type: 'link',
            version: 3,
            fields: {
              linkType: 'internal',
              newTab: false,
              doc: { relationTo: 'posts', value: draftPost.id },
            },
            children: [{ type: 'text', text: 'draft link', version: 1 }],
          },
        ],
      }),
      ...published,
    },
    ...as,
  })
  ids.post = post.id
  // A second published post by the same author: the byline must not make rows collide
  const second = await production.create({
    collection: 'posts',
    data: {
      title: 'Second by the same author',
      slug: 'second-post',
      authors: [admin.id],
      content: paragraph('s'),
      ...published,
    },
    ...as,
  })
  ids.second = second.id
  await production.update({
    collection: 'posts',
    id: post.id,
    data: { relatedPosts: [related.id, draftPost.id] },
    ...as,
  })
  ids.related = related.id
  ids.draftPost = draftPost.id
  // An unpublished edit on top of the published post: the copy has the published title
  await production.update({
    collection: 'posts',
    id: post.id,
    data: { title: 'Draft edit title' },
    draft: true,
    ...as,
  })

  await production.create({
    collection: 'pages',
    data: {
      title: 'About',
      slug: 'about',
      hero: { type: 'none' },
      layout: [{ blockType: 'cta' }],
      ...published,
    } as never,
    ...as,
  })
  await production.create({
    collection: 'team-members',
    data: {
      memberType: 'board-member',
      name: 'Pat Board',
      role: 'Chair',
      status: 'active',
      email: SECRET_EMAIL,
    },
    ...as,
  })
  await production.create({
    collection: 'forms',
    data: {
      title: 'Contact',
      fields: [],
      confirmationMessage: paragraph('Thanks'),
      emails: [{ emailTo: RECIPIENT, emailFrom: RECIPIENT, subject: 's', message: paragraph('m') }],
    } as never,
    ...as,
  })
  await production.db.create({
    collection: 'form-submissions',
    data: { form: 1, submissionData: [{ id: 'a', field: 'email', value: SECRET_EMAIL }] } as never,
  })
  await production.updateGlobal({
    slug: 'header',
    data: {
      navItems: [
        {
          link: {
            type: 'reference',
            label: 'About',
            reference: { relationTo: 'pages', value: 1 },
          },
        },
        {
          link: {
            type: 'reference',
            label: 'Draft',
            reference: { relationTo: 'posts', value: draftPost.id },
          },
        },
      ],
    },
    ...as,
  })

  // A hook that adds a property to every post it reads: the copy keeps only classified fields
  production.collections.posts.config.hooks.afterRead.push(async ({ doc }) => ({
    ...doc,
    leaked: 'hook-added-value',
  }))

  const result = await exportPreviewCopy(production)
  return { production, config, ids, ...result }
}
