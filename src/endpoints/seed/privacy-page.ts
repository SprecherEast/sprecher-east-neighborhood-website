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
              'We count visits to see which pages help neighbors. The counter runs on our own server and sets no cookies. It keeps no names, emails or IP addresses, and ignores anything after a ? in a page address.',
            ),
            p(
              'Each visit notes the page and its title, where you came from, your browser, system, screen size and language, and your country, region and city. If your browser sends Do Not Track, we don’t count you. We keep the counts until we delete them.',
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
