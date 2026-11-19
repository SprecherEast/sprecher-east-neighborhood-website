import type { RequiredDataFromCollectionSlug } from 'payload'
import type { PostArgs } from './post-1'
import { heading, root, p } from './helpers/lexical'

// "WisDOT Holds Public Hearings on I-39/90/94 Corridor Study"
export const post2: (args: PostArgs) => RequiredDataFromCollectionSlug<'posts'> = ({
  heroImage,
  author,
}) => {
  return {
    slug: 'wisdot-i39-corridor-hearings-2024',
    _status: 'published',
    authors: [author],
    content: root([
      heading(
        'h2',
        'The Wisconsin Department of Transportation held public hearings on major corridor improvements to I-39/90/94.',
      ),
      p(
        'The Wisconsin Department of Transportation (WisDOT) held three public hearings to update the community on the I-39/90/94 Corridor Study\u2019s Draft Environmental Impact Statement and preferred alternatives.',
      ),
      p(
        'A virtual hearing took place July 29, 2024 via YouTube Live. An in-person hearing was held July 30, 2024 at Madison College Truax Building, 1701 Wright Street, Madison, WI 53704.',
      ),
      p(
        'The I-39/90/94 corridor is a critical transportation route that directly affects neighbors on Madison\u2019s far east side. Changes to this corridor will impact traffic patterns, noise levels, and development potential in the Sprecher East area for decades to come.',
      ),
      p(
        'Neighbors are encouraged to stay informed about this project as it progresses. The WisDOT project page has the latest information, maps, and environmental impact documents.',
      ),
    ]),
    heroImage: heroImage.id,
    meta: {
      description:
        'WisDOT held public hearings on the I-39/90/94 Corridor Study. The project directly affects Madison\u2019s far east side neighbors.',
      image: heroImage.id,
      title: 'WisDOT Holds Public Hearings on I-39/90/94 Corridor Study',
    },
    publishedAt: '2024-07-25T12:00:00.000Z',
    // The hearings were WisDOT's own; its site has the project's documents (#483)
    sourceName: 'Wisconsin Department of Transportation',
    sourceUrl: 'https://wisconsindot.gov/',
    relatedPosts: [],
    title: 'WisDOT Holds Public Hearings on I-39/90/94 Corridor Study',
  }
}
