import type { RequiredDataFromCollectionSlug } from 'payload'
import { heading, paragraph, text, root } from './helpers/lexical'
import { HOME_DESCRIPTION } from './home-description'

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
    description: HOME_DESCRIPTION,
    title: 'Home',
  },
  title: 'Home',
  layout: [],
}
