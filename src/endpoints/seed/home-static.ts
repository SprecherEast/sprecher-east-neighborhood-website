import type { RequiredDataFromCollectionSlug } from 'payload'
import { heading, paragraph, text, root } from './helpers/lexical'

// Used for pre-seeded content so that the homepage is not empty
export const homeStatic: RequiredDataFromCollectionSlug<'pages'> = {
  slug: 'home',
  _status: 'published',
  hero: {
    type: 'lowImpact',
    richText: root([
      heading('h1', 'Sprecher East'),
      paragraph(
        text(
          'Welcome to Sprecher East, an unofficial site for Madison\u2019s Far East Side. The full site is on its way.',
        ),
      ),
    ]),
  },
  meta: {
    description:
      'News, events and City updates for Sprecher East on Madison\u2019s Far East Side: Meadowlands, Door Creek and Reston Heights. An unofficial site.',
    title: 'Home',
  },
  title: 'Home',
  layout: [],
}
