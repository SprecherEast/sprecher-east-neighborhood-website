import type { RequiredDataFromCollectionSlug } from 'payload'
import type { PostArgs } from './post-1'
import { heading, root, p } from './helpers/lexical'

// "Welcome to the Sprecher East Website"
export const post3: (args: PostArgs) => RequiredDataFromCollectionSlug<'posts'> = ({
  heroImage,
  author,
}) => {
  return {
    slug: 'welcome-new-website',
    _status: 'published',
    authors: [author],
    content: root([
      heading(
        'h2',
        'We\u2019ve refreshed our neighborhood website to make it easier to find events, news, and resources.',
      ),
      p(
        'Sprecher East is one of the newest neighborhoods on the far east side of Madison. We are bounded by I-94 to the north, Door Creek Park to the east, Sprecher Road to the west, and Cottage Grove Road to the south.',
      ),
      p(
        'Our neighborhood includes the Meadowlands, Door Creek, and Reston Heights subdivisions. This unofficial site, run by one neighbor, shares news and events for the area.',
      ),
      p(
        'There\u2019s no membership and no dues. We\u2019re here to keep neighbors informed and share what\u2019s happening around us.',
      ),
      p('Stay connected \u2014 check this site for upcoming events and news!'),
    ]),
    heroImage: heroImage.id,
    meta: {
      description:
        'We\u2019ve refreshed our neighborhood website to make it easier to find events, news, and resources.',
      image: heroImage.id,
      title: 'Welcome to the Sprecher East Website',
    },
    publishedAt: '2024-02-01T12:00:00.000Z',
    relatedPosts: [],
    title: 'Welcome to the Sprecher East Website',
  }
}
