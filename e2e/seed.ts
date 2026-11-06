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

await payload.create({
  collection: 'posts',
  depth: 0,
  data: alignmentPost(figure.id),
  context,
  overrideAccess: true, // test setup, no user
})

payload.logger.info('e2e: seeded the contact form and page, and the alignment post')
process.exit(0)
