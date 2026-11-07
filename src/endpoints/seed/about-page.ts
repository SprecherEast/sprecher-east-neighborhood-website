import type { RequiredDataFromCollectionSlug } from 'payload'
import type { Media } from '@/payload-types'
import { heading, root, p } from './helpers/lexical'

type AboutArgs = {
  mapImage?: Media
}

export const aboutPage: (args?: AboutArgs) => RequiredDataFromCollectionSlug<'pages'> = (args) => {
  const layout: RequiredDataFromCollectionSlug<'pages'>['layout'] = [
    {
      blockName: 'Who We Are',
      blockType: 'content',
      columns: [
        {
          richText: root([
            heading('h2', 'Hello, neighbor'),
            p(
              'Sprecher East is a friendly group of neighbors on Madison\u2019s far east side. We share news, events and ways to meet each other.',
            ),
            p(
              'We are not a homeowners association. There are no dues and no rules about your fence or your paint. Anyone who lives here is welcome.',
            ),
            p(
              'This site is unofficial, and AI helps us write and organize it. People still decide what goes on it.',
            ),
          ]),
          size: 'full',
        },
      ],
    },
  ]

  if (args?.mapImage) {
    layout.push({
      blockName: 'Neighborhood Map',
      blockType: 'mapBlock',
      title: 'Where we are',
      description:
        'Find us between I-94 to the north, Sprecher Road to the west and Cottage Grove Road to the south, with Door Creek Park to the east. We are in Madison\u2019s District 16. North Star lies to the west, and Richmond Hill Homeowners to the southwest.',
      preview: args.mapImage.id,
    })
  }

  layout.push({
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
      heading('h3', 'Come say hello'),
      p('New here or been here for years, we would love to hear from you.'),
    ]),
  })

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
        'Meet Sprecher East, a friendly group of neighbors on Madison\u2019s far east side, and see where we are on the map.',
      title: 'About',
    },
    title: 'About',
  }
}
