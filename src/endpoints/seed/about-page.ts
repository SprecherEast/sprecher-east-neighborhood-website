import type { RequiredDataFromCollectionSlug } from 'payload'
import type { Media } from '@/payload-types'
import { heading, linkNode, p, paragraph, root, text } from './helpers/lexical'

type AboutArgs = {
  mapImage?: Media
}

/** The shared "Sprecher East" Google My Maps map: the boundary, drawn by the owner (#764) */
const SPRECHER_EAST_MAP_EMBED_URL =
  'https://www.google.com/maps/d/embed?mid=1mbTKP1-2eN6g5YPReAaQg6J1lV2DX7g'

/** A section item's other layout choices, at their defaults */
const ITEM = { align: 'start', verticalAlign: 'top', phoneOrder: 'inOrder' } as const

export const aboutPage: (args?: AboutArgs) => RequiredDataFromCollectionSlug<'pages'> = (args) => {
  const intro = {
    blockName: 'What This Site Is',
    blockType: 'content' as const,
    columns: [
      {
        richText: root([
          heading('h2', 'What this site is'),
          p(
            'This is an unofficial site for Sprecher East, the neighborhood on Madison’s far east side. We gather news, events and public notices for neighbors in one place.',
          ),
          p(
            'It’s run by one neighbor, not by the City, an HOA or a registered neighborhood association, and there are no dues or membership.',
          ),
        ]),
        size: 'full' as const,
      },
    ],
  }

  // The text takes two thirds and the map one third, side by side from a large screen up and stacked
  // on a phone; an editor changes the widths, the order or the alignment in Admin (#884)
  const layout: RequiredDataFromCollectionSlug<'pages'>['layout'] = args?.mapImage
    ? [
        {
          blockName: 'Intro and Map',
          blockType: 'section',
          items: [
            { ...ITEM, width: 'twoThirds', content: [intro] },
            {
              ...ITEM,
              width: 'oneThird',
              content: [
                {
                  blockName: 'Neighborhood Map',
                  blockType: 'mapBlock',
                  title: 'Where we are',
                  description:
                    'Sprecher East is in Madison’s District 16. I-94 is to the north, Sprecher Road to the west, and Cottage Grove Road to the south. Door Creek Park and the Door Creek valley lie to the east. North Star is next door to the west, and Richmond Hill Homeowners lies to the southwest.',
                  preview: args.mapImage.id,
                  embedUrl: SPRECHER_EAST_MAP_EMBED_URL,
                },
              ],
            },
          ],
        },
      ]
    : [intro]

  layout.push(
    {
      blockName: 'How AI Helps',
      blockType: 'content',
      columns: [
        {
          richText: root([
            heading('h2', 'How AI helps'),
            p(
              'AI tools help us gather public information, like city meetings, road and development projects, and local news. A neighbor reviews what we publish, and longer pieces list their sources.',
            ),
            paragraph(
              text('If enough neighbors want one, forming a neighborhood association is a goal. '),
              linkNode('Here’s the story so far', '/posts/sprecher-east-is-coming-together'),
              text('.'),
            ),
          ]),
          size: 'full',
        },
      ],
    },
    {
      blockName: 'Get Involved CTA',
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
        heading('h3', 'See something wrong or missing?'),
        p('Tell us, and we’ll fix it.'),
      ]),
    },
  )

  return {
    slug: 'about',
    _status: 'published',
    hero: {
      type: 'lowImpact',
      richText: root([heading('h1', 'About Sprecher East')]),
    },
    layout,
    meta: {
      description:
        'What this unofficial site is, who runs it, and where Sprecher East sits on Madison’s far east side, with a map.',
      title: 'About',
    },
    title: 'About',
  }
}
