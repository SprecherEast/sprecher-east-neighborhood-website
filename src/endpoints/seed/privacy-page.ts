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
              'Each visit notes the page and its title, where you came from, and your country, region and city. It also notes your browser, device, system, screen size and language. If your browser sends Do Not Track, we don’t count you. We keep these notes until we delete them.',
            ),
            p(
              'Robots visit too, so we also note a click on a button, or on a link that leaves our site. That is a likely person, not certain. We count each once per visit, and note the button’s name or the other site’s name, not the full address. A browser with Do Not Track sends none of this.',
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
