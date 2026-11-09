import type { RequiredDataFromCollectionSlug } from 'payload'
import { heading, p, root } from './helpers/lexical'

/** What the site tells neighbors about the visit counter (#950). Keep it true to what Umami stores. */
export const privacyPage: () => RequiredDataFromCollectionSlug<'pages'> = () => ({
  slug: 'privacy',
  _status: 'published',
  hero: {
    type: 'lowImpact',
    richText: root([heading('h1', 'Privacy')]),
  },
  layout: [
    {
      blockName: 'Counting Visits',
      blockType: 'content',
      columns: [
        {
          richText: root([
            heading('h2', 'Counting visits'),
            p(
              'We count visits to see which pages help neighbors. The counter runs on our own server, sets no cookies, and keeps no names, emails or other personal details.',
            ),
            p(
              'It notes the page, where you came from, your browser and device type, and a rough area. If your browser sends Do Not Track, we don’t count you at all.',
            ),
          ]),
          size: 'full',
        },
      ],
    },
  ],
  meta: {
    description: 'How Sprecher East counts visits without cookies or personal details.',
    title: 'Privacy',
  },
  title: 'Privacy',
})
