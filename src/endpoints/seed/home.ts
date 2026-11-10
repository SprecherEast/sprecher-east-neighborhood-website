import type { RequiredDataFromCollectionSlug } from 'payload'
import type { Media } from '@/payload-types'
import { heading, paragraph, text, boldText, root, p } from './helpers/lexical'

type HomeArgs = {
  heroImage: Media
  metaImage: Media
  /** The category the "this week" strip's Family row lists (#122) */
  familyCategoryId: number
  /** The posts "top issues" links to (#484) */
  corridorPostId: number
  comingTogetherPostId: number
}

/** The neighborhood's forum, where a top issue can send residents to talk it over (#484) */
const FORUM_URL = 'https://discourse.sprechereast.org'

export const home: (args: HomeArgs) => RequiredDataFromCollectionSlug<'pages'> = ({
  heroImage,
  metaImage,
  familyCategoryId,
  corridorPostId,
  comingTogetherPostId,
}) => {
  return {
    slug: 'home',
    _status: 'published',
    hero: {
      type: 'highImpact',
      links: [
        {
          link: {
            type: 'custom',
            appearance: 'default',
            label: 'Upcoming Events',
            url: '/events',
          },
        },
        {
          link: {
            type: 'custom',
            appearance: 'outline',
            label: 'Get Involved',
            url: '/get-involved',
          },
        },
      ],
      media: heroImage.id,
      richText: root([
        heading('h1', 'Your Neighborhood, Your Community'),
        p(
          'News, events and City updates for Sprecher East on Madison\u2019s Far East Side: Meadowlands, Door Creek and Reston Heights.',
        ),
      ]),
    },
    layout: [
      {
        blockName: 'This Week',
        blockType: 'eventsThisWeek',
        heading: 'This week in Sprecher East',
        days: 7,
        rows: [
          { title: 'Coming up', source: 'all', limit: 3 },
          { title: 'Civic and official', source: 'official', limit: 3 },
          { title: 'Family', source: 'category', category: familyCategoryId, limit: 3 },
        ],
      },
      {
        blockName: 'Top Issues',
        blockType: 'topIssues',
        heading: 'Top issues right now',
        items: [
          {
            title: 'I-39/90/94 corridor study',
            summary:
              'WisDOT held public hearings on the corridor study, which affects Madison\u2019s far east side.',
            link: { type: 'reference', reference: { relationTo: 'posts', value: corridorPostId } },
          },
          {
            title: 'Help shape Sprecher East',
            summary: 'Why this site exists, and how neighbors can take part.',
            link: {
              type: 'reference',
              reference: { relationTo: 'posts', value: comingTogetherPostId },
            },
          },
          {
            title: 'Talk it over on the forum',
            summary: 'Questions and ideas from neighbors, in one place.',
            link: { type: 'custom', url: FORUM_URL, newTab: true },
          },
        ],
      },
      {
        blockName: 'About the Neighborhood',
        blockType: 'content',
        columns: [
          {
            richText: root([
              heading('h2', 'About the Neighborhood'),
              p(
                'Sprecher East covers the far east side of Madison, bounded by I-94 to the north, Door Creek Park to the east, Sprecher Road to the west, and Cottage Grove Road to the south. Our community includes the Meadowlands, Door Creek, and Reston Heights subdivisions.',
              ),
              p(
                'This is an unofficial site, not an HOA or an association. There are no dues and no rules, just news, events and City updates for neighbors.',
              ),
            ]),
            size: 'twoThirds',
          },
          {
            richText: root([
              heading('h3', 'Quick Facts'),
              p('\u2713 Far East Side \u2014 Madison\u2019s District 16'),
              p('\u2713 Three subdivisions \u2014 Meadowlands, Door Creek, Reston Heights'),
              p('\u2713 No membership \u2014 no sign-up, no dues'),
            ]),
            size: 'oneThird',
          },
        ],
      },
      {
        blockName: 'Recent News',
        blockType: 'archive',
        categories: [],
        introContent: root([
          heading('h3', 'Recent News'),
          p('Stay up to date with what\u2019s happening in the Sprecher East neighborhood.'),
        ]),
        populateBy: 'collection',
        relationTo: 'posts',
      },
      {
        blockName: 'Join Your Neighbors',
        blockType: 'cta',
        links: [
          {
            link: {
              type: 'custom',
              appearance: 'default',
              label: 'Get Involved',
              url: '/get-involved',
            },
          },
          {
            link: {
              type: 'custom',
              appearance: 'outline',
              label: 'Contact Us',
              url: '/contact',
            },
          },
        ],
        richText: root([
          heading('h3', 'Know something we\u2019re missing?'),
          paragraph(
            text('Whether you\u2019ve lived here for years or just moved in, '),
            boldText('please tell us.'),
          ),
        ]),
      },
    ],
    meta: {
      description:
        'News, events and City updates for Sprecher East on Madison\u2019s Far East Side: Meadowlands, Door Creek and Reston Heights. An unofficial site.',
      image: metaImage.id,
      title: 'Home',
    },
    title: 'Home',
  }
}
