/**
 * The content the end-to-end tests need (#311), written once into the fresh test database by
 * `payload run` before the server starts: the contact form and the contact page that shows it,
 * from the demo seed's own data. The full demo seed is off in production builds on purpose
 * (`isSeedEnabled`), and the tests need nothing else from it.
 */
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { contactForm } from '../src/endpoints/seed/contact-form'
import { contact } from '../src/endpoints/seed/contact-page'
import { root, p } from '../src/endpoints/seed/helpers/lexical'
import { alignmentPost, FIGURE_CAPTION } from './support/alignmentPage'
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

payload.logger.info('e2e: seeded the contact form and page, the alignment post and an event')
process.exit(0)
