/**
 * The content the end-to-end tests need (#311), written once into the fresh test database by
 * `payload run` before the server starts: the contact form and the contact page that shows it,
 * from the demo seed's own data. The full demo seed is off in production builds on purpose
 * (`isSeedEnabled`), and the tests need nothing else from it.
 */
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../src/payload.config'
import { contactForm } from '../src/endpoints/seed/contact-form'
import { contact } from '../src/endpoints/seed/contact-page'
import { root, p } from '../src/endpoints/seed/helpers/lexical'
import { alignmentPost, FIGURE_CAPTION } from './support/alignmentPage'
import {
  BLACK_EVENT_SLUG,
  BLACK_PAGE_SLUG,
  BLACK_POST_SLUG,
  WHITE_EVENT_SLUG,
  WHITE_PAGE_SLUG,
  WHITE_POST_SLUG,
  backdropEvent,
  backdropPage,
  backdropPost,
  plainPost,
} from './support/backdropPages'
import { billPost } from './support/billPage'
import { EDGES_EVENT_SLUG } from './support/alignmentSlug'
import { pictureCardsPost, pictureEvent, picturePost } from './support/featuredPicturePages'

const payload = await getPayload({ config })
const context = { disableRevalidate: true }

const form = await payload.create({
  collection: 'forms',
  depth: 0,
  data: contactForm,
  context,
  overrideAccess: true, // test setup, no user
})
await payload.create({
  collection: 'pages',
  depth: 0,
  data: contact({ contactForm: form }),
  context,
  overrideAccess: true, // test setup, no user
})

// The figure's picture is one of the demo seed's own, with a caption (#658)
const figure = await payload.create({
  collection: 'media',
  depth: 0,
  data: { alt: 'A sample figure', caption: root([p(FIGURE_CAPTION)]) },
  filePath: 'src/endpoints/seed/image-post1.webp',
  context,
  overrideAccess: true, // test setup, no user
})

// An author with a long name, for the metadata bar's cut value (#1055)
const author = await payload.create({
  collection: 'users',
  depth: 0,
  data: {
    name: 'Bartholomew Featherstonehaugh-Kowalczyk and Dorothea Wainwright-Papadopoulos',
    email: 'long-name-author@example.com',
    role: 'guest',
    password: crypto.randomUUID(),
  },
  // The seed runs before the mail catcher listens
  disableVerificationEmail: true,
  context,
  overrideAccess: true, // test setup, no user
})

await payload.create({
  collection: 'posts',
  depth: 0,
  data: alignmentPost(figure.id, author.id),
  context,
  overrideAccess: true, // test setup, no user
})

await payload.create({
  collection: 'posts',
  depth: 0,
  data: billPost(author.id),
  context,
  overrideAccess: true, // test setup, no user
})

await payload.create({
  collection: 'events',
  depth: 0,
  data: {
    slug: EDGES_EVENT_SLUG,
    title: 'Edges check',
    _status: 'published',
    date: '2030-01-15T00:00:00.000Z',
    timeStart: '6:30 PM',
    timeEnd: '8:30 PM',
    locationType: 'hybrid',
    locationName:
      'The community room at the far end of the long lakeside building next to the Sprecher Road library branch',
    locationAddress: '4605 Sprecher Rd, Madison, WI',
    content: root([p('Some text under the event’s panels.')]),
  },
  context,
  overrideAccess: true, // test setup, no user
})

// Posts and an event that carry a picture, for the featured-picture test (#1023)
for (const [collection, data] of [
  ['posts', picturePost(figure.id)],
  ['posts', pictureCardsPost(figure.id)],
  ['events', pictureEvent(figure.id)],
] as const) {
  await payload.create({
    collection,
    depth: 0,
    data: data as never,
    context,
    overrideAccess: true, // test setup, no user
  })
}

// A neighborhood photo behind a post, an event and a page, and a post without one (#1268)
const photo = await payload.create({
  collection: 'media',
  depth: 0,
  data: { alt: 'A path through a field at dusk' },
  filePath: 'public/images/image-8.jpeg',
  context,
  overrideAccess: true, // test setup, no user
})
// Solid white and solid black photos: any photo lies between them, so text that passes over both
// passes over every photo
const solid = async (name: string, background: string) => {
  const data = await sharp({ create: { width: 1600, height: 1000, channels: 3, background } })
    .jpeg()
    .toBuffer()
  return payload.create({
    collection: 'media',
    depth: 0,
    data: { alt: `A solid ${name} test photo` },
    file: { data, mimetype: 'image/jpeg', name: `${name}.jpg`, size: data.length },
    context,
    overrideAccess: true, // test setup, no user
  })
}
const white = await solid('white', '#ffffff')
const black = await solid('black', '#000000')
for (const [collection, data] of [
  ['posts', backdropPost(white.id, WHITE_POST_SLUG)],
  ['posts', backdropPost(black.id, BLACK_POST_SLUG)],
  ['events', backdropEvent(white.id, WHITE_EVENT_SLUG)],
  ['events', backdropEvent(black.id, BLACK_EVENT_SLUG)],
  ['pages', backdropPage(white.id, WHITE_PAGE_SLUG)],
  ['pages', backdropPage(black.id, BLACK_PAGE_SLUG)],
  ['posts', backdropPost(photo.id)],
  ['posts', plainPost()],
  ['events', backdropEvent(photo.id)],
  ['pages', backdropPage(photo.id)],
] as const) {
  await payload.create({
    collection,
    depth: 0,
    data: data as never,
    context,
    overrideAccess: true, // test setup, no user
  })
}

// Resources across the page's groups, for the resources page test (#1236)
for (const [title, category] of [
  ['Sample utility', 'utilities'],
  ['Sample official', 'elected-officials'],
  ['Sample safety line', 'public-safety'],
  ['Sample tenant help', 'renting'],
  ['Sample park', 'parks'],
  ['Sample childcare', 'childcare'],
] as const) {
  await payload.create({
    collection: 'resources',
    depth: 0,
    data: { title, category, _status: 'published' },
    context,
    overrideAccess: true, // test setup, no user
  })
}

// The header's Resources menu opens to the five groups (#1237)
await payload.updateGlobal({
  slug: 'header',
  depth: 0,
  context,
  data: {
    navItems: [
      {
        link: { type: 'custom', label: 'Resources', url: '/resources/utilities' },
        subItems: [
          {
            link: { type: 'custom', label: 'Neighborhood utilities', url: '/resources/utilities' },
          },
          { link: { type: 'custom', label: 'Government', url: '/resources/government' } },
          { link: { type: 'custom', label: 'Safety and health', url: '/resources/safety-health' } },
        ],
      },
    ],
  },
})

payload.logger.info('e2e: seeded the contact form and page, the alignment post and an event')
process.exit(0)
