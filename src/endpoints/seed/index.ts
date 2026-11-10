import type { CollectionSlug, GlobalSlug, Payload, PayloadRequest, File } from 'payload'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { ROLES } from '@/platform/lib'
import { contactForm as contactFormData } from './contact-form'
import { contact as contactPageData } from './contact-page'
import { home } from './home'
import { aboutPage } from './about-page'
import { getInvolvedPage } from './get-involved-page'
import { privacyPage } from './privacy-page'
import { associationPage } from './association-page'
import { image1 } from './image-1'
import { image2 } from './image-2'
import { image3 } from './image-3'
import { imageHero1 } from './image-hero-1'
import { imagePark } from './image-park'
import { placeholderPortrait, placeholderPortraitFile } from './placeholder-portrait'
import { post1 } from './post-1'
import { post2 } from './post-2'
import { post3 } from './post-3'
import { faqItems } from './data/faq'
import { resourceItems } from './data/resources'
import { seedCategories } from './data/categories'
import { eventItems } from './data/events'
import { FORUM_DEFAULT_URL } from '@/modules/site'

const collections: CollectionSlug[] = [
  'categories',
  'media',
  'pages',
  'posts',
  'events',
  'faq',
  'resources',
  'team-members',
  'forms',
  'form-submissions',
  'search',
]

// The navigation globals; Payload's own `payload-jobs-stats` is left alone
const globals = ['header', 'footer'] as const satisfies readonly GlobalSlug[]

// Next.js revalidation errors are normal when seeding the database without a server running
// i.e. running `yarn seed` locally instead of using the admin UI within an active app
// The app is not running to revalidate the pages and so the API routes are not available
// These error messages can be ignored: `Error hitting revalidate route for...`
export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  payload.logger.info('Seeding database...')

  payload.logger.info(`— Clearing collections and globals...`)

  await Promise.all(
    globals.map((global) =>
      payload.updateGlobal({
        slug: global,
        data: {
          navItems: [],
        },
        depth: 0,
        context: {
          disableRevalidate: true,
        },
      }),
    ),
  )

  await Promise.all(
    collections.map((collection) => payload.db.deleteMany({ collection, req, where: {} })),
  )

  await Promise.all(
    collections
      .filter((collection) => Boolean(payload.collections[collection].config.versions))
      .map((collection) => payload.db.deleteVersions({ collection, req, where: {} })),
  )

  payload.logger.info(`— Seeding author...`)

  await payload.delete({
    collection: 'users',
    depth: 0,
    where: {
      email: {
        equals: 'demo-author@example.com',
      },
    },
  })

  payload.logger.info(`— Seeding media...`)

  // Try to load local images from public/images/, fall back to remote Payload template images
  const [image1Buffer, image2Buffer, image3Buffer, hero1Buffer, parkBuffer] = await Promise.all([
    loadLocalImage('image-asset.jpeg', 'image/jpeg').catch(() =>
      fetchFileByURL(POST1_FALLBACK_URL),
    ),
    loadLocalImage('image.jpeg', 'image/jpeg').catch(() =>
      fetchFileByURL(
        'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post2.webp',
      ),
    ),
    loadLocalImage('sprecher-east-map.png', 'image/png').catch(() =>
      fetchFileByURL(
        'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post3.webp',
      ),
    ),
    loadLocalImage('photo.jpeg', 'image/jpeg').catch(() =>
      fetchFileByURL(
        'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-hero1.webp',
      ),
    ),
    loadLocalImage('parks-greenspace.jpg', 'image/jpeg').catch(() =>
      fetchFileByURL(POST1_FALLBACK_URL),
    ),
  ])

  const seedPassword = process.env.SEED_PASSWORD || crypto.randomUUID()
  if (!process.env.SEED_PASSWORD) {
    payload.logger.warn('— SEED_PASSWORD not set, using random password for demo user')
  }

  const [demoAuthor, image1Doc, image2Doc, image3Doc, imageHomeDoc, imageParkDoc] =
    await Promise.all([
      payload.create({
        collection: 'users',
        data: {
          name: 'Sprecher East',
          email: 'demo-author@example.com',
          password: seedPassword,
          role: ROLES.admin,
          // The demo admin can sign in at once: with `auth.verify` on, Payload would otherwise
          // store it unverified and email example.com a link (#187)
          _verified: true,
        },
        disableVerificationEmail: true,
      }),
      payload.create({
        collection: 'media',
        data: image1,
        file: image1Buffer,
      }),
      payload.create({
        collection: 'media',
        data: image2,
        file: image2Buffer,
      }),
      payload.create({
        collection: 'media',
        data: image3,
        file: image3Buffer,
      }),
      payload.create({
        collection: 'media',
        data: imageHero1,
        file: hero1Buffer,
      }),
      payload.create({
        collection: 'media',
        data: imagePark,
        file: parkBuffer,
      }),
    ])

  payload.logger.info(`— Seeding posts...`)

  // Create posts sequentially to preserve order by createdAt
  const post1Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: { disableRevalidate: true },
    data: post1({ heroImage: imageParkDoc, author: demoAuthor }),
  })

  const post2Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: { disableRevalidate: true },
    data: post2({ heroImage: image2Doc, author: demoAuthor }),
  })

  const post3Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: { disableRevalidate: true },
    data: post3({ heroImage: image1Doc, author: demoAuthor }),
  })

  // Update related posts
  await Promise.all([
    payload.update({
      id: post1Doc.id,
      collection: 'posts',
      data: { relatedPosts: [post2Doc.id, post3Doc.id] },
    }),
    payload.update({
      id: post2Doc.id,
      collection: 'posts',
      data: { relatedPosts: [post1Doc.id, post3Doc.id] },
    }),
    payload.update({
      id: post3Doc.id,
      collection: 'posts',
      data: { relatedPosts: [post1Doc.id, post2Doc.id] },
    }),
  ])

  payload.logger.info(`— Seeding FAQ...`)

  for (const faq of faqItems) {
    await payload.create({
      collection: 'faq',
      depth: 0,
      context: { disableRevalidate: true },
      data: {
        ...faq,
        _status: 'published',
      },
    })
  }

  payload.logger.info(`— Seeding resources...`)

  const portraitDoc = await payload.create({
    collection: 'media',
    data: placeholderPortrait,
    file: await placeholderPortraitFile(),
  })

  for (const { placeholderPortraitCredit, ...resource } of resourceItems) {
    await payload.create({
      collection: 'resources',
      depth: 0,
      context: { disableRevalidate: true },
      data: {
        ...resource,
        ...(placeholderPortraitCredit && {
          photo: portraitDoc.id,
          photoCredit: placeholderPortraitCredit,
        }),
        _status: 'published',
      },
    })
  }

  payload.logger.info(`— Seeding events...`)

  const categoryIds = new Map<string, number>()
  for (const [slug, title] of Object.entries(seedCategories)) {
    const category = await payload.create({
      collection: 'categories',
      depth: 0,
      data: { title, slug },
    })
    categoryIds.set(slug, category.id)
  }

  for (const { category, ...event } of eventItems) {
    const categoryId = categoryIds.get(category)
    await payload.create({
      collection: 'events',
      depth: 0,
      context: { disableRevalidate: true },
      data: {
        ...event,
        categories: categoryId === undefined ? [] : [categoryId],
        _status: 'published',
      },
    })
  }

  payload.logger.info(`— Seeding team members...`)

  const boardPositions = [
    { name: 'Board President', role: 'President', order: 1 },
    { name: 'Vice President', role: 'Vice President', order: 2 },
    { name: 'Secretary', role: 'Secretary', order: 3 },
    { name: 'Treasurer', role: 'Treasurer', order: 4 },
  ]

  for (const member of boardPositions) {
    await payload.create({
      collection: 'team-members',
      depth: 0,
      data: {
        memberType: 'board-member',
        name: member.name,
        role: member.role,
        bio: `${member.role} of the Sprecher East Neighborhood Association.`,
        status: 'active',
        order: member.order,
      },
    })
  }

  payload.logger.info(`— Seeding contact form...`)

  const contactForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: contactFormData,
  })

  payload.logger.info(`— Seeding pages...`)

  // The home page's "this week" strip lists the Family category (#122)
  const requireCategory = (ids: Map<string, number>, slug: string) => {
    const id = ids.get(slug)
    if (id === undefined) throw new Error(`The seed has no "${slug}" category`)
    return id
  }

  const [_homePage, contactPage, aboutPageDoc, getInvolvedDoc, _associationDoc, _privacyDoc] =
    await Promise.all([
      payload.create({
        collection: 'pages',
        depth: 0,
        data: home({
          heroImage: imageHomeDoc,
          metaImage: image1Doc,
          familyCategoryId: requireCategory(categoryIds, 'family'),
          corridorPostId: post2Doc.id,
          comingTogetherPostId: post1Doc.id,
        }),
      }),
      payload.create({
        collection: 'pages',
        depth: 0,
        data: contactPageData({ contactForm }),
      }),
      payload.create({
        collection: 'pages',
        depth: 0,
        data: aboutPage({ mapImage: image3Doc }),
      }),
      payload.create({
        collection: 'pages',
        depth: 0,
        data: getInvolvedPage(),
      }),
      payload.create({
        collection: 'pages',
        depth: 0,
        data: associationPage(),
      }),
      payload.create({
        collection: 'pages',
        depth: 0,
        data: privacyPage(),
      }),
    ])

  payload.logger.info(`— Seeding globals...`)

  await Promise.all([
    payload.updateGlobal({
      slug: 'header',
      data: {
        navItems: [
          {
            link: {
              type: 'reference',
              label: 'About',
              reference: {
                relationTo: 'pages',
                value: aboutPageDoc.id,
              },
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Events',
              url: '/events',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'News',
              url: '/posts',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Resources',
              url: '/resources',
            },
          },
          {
            link: {
              type: 'reference',
              label: 'Get Involved',
              reference: {
                relationTo: 'pages',
                value: getInvolvedDoc.id,
              },
            },
          },
          {
            link: {
              type: 'reference',
              label: 'Contact',
              reference: {
                relationTo: 'pages',
                value: contactPage.id,
              },
            },
          },
        ],
      },
    }),
    payload.updateGlobal({
      slug: 'footer',
      data: {
        forumUrl: FORUM_DEFAULT_URL,
        navItems: [
          {
            link: {
              type: 'custom',
              label: 'FAQ',
              url: '/faq',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Privacy',
              url: '/privacy',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Source Code',
              newTab: true,
              url: 'https://github.com/SprecherEast/sprecher-east-neighborhood-website',
            },
          },
        ],
      },
    }),
  ])

  payload.logger.info('Seeded database successfully!')
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Remote stand-in used when a local photo is missing
const POST1_FALLBACK_URL =
  'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post1.webp'

/**
 * Load an image from the public/images/ directory.
 * Tries multiple possible base paths (dev vs built vs VPS deploy).
 */
async function loadLocalImage(filename: string, mimetype: string): Promise<File> {
  const possiblePaths = [
    path.resolve(process.cwd(), 'public/images', filename),
    path.resolve(__dirname, '../../../../public/images', filename),
  ]

  for (const filePath of possiblePaths) {
    try {
      const data = await fs.readFile(/*turbopackIgnore: true*/ filePath)
      return {
        name: filename,
        data: Buffer.from(data),
        mimetype,
        size: data.byteLength,
      }
    } catch {
      // Try next path
    }
  }

  throw new Error(`Local image not found: ${filename}`)
}

async function fetchFileByURL(url: string): Promise<File> {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'GET',
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch file from ${url}, status: ${res.status}`)
  }

  const data = await res.arrayBuffer()

  return {
    name: url.split('/').pop() || `file-${Date.now()}`,
    data: Buffer.from(data),
    mimetype: `image/${url.split('.').pop()}`,
    size: data.byteLength,
  }
}
