import type { RequiredDataFromCollectionSlug } from 'payload'
import { heading, root, p } from './helpers/lexical'

export const associationPage: () => RequiredDataFromCollectionSlug<'pages'> = () => {
  return {
    slug: 'association',
    // A draft and linked from nowhere: the site doesn't present itself as an association (#1010)
    _status: 'draft',
    hero: {
      type: 'lowImpact',
      richText: root([heading('h1', 'The Association')]),
    },
    layout: [
      {
        blockName: 'Mission',
        blockType: 'content',
        columns: [
          {
            richText: root([
              heading('h2', 'Our Mission'),
              p(
                'The Sprecher East Neighborhood Association exists to represent the interests of residents in the Sprecher East area, to keep neighbors informed about issues affecting our community, and to build connections among the people who live here.',
              ),
            ]),
            size: 'full',
          },
        ],
      },
      {
        blockName: 'Mission Pillars',
        blockType: 'content',
        columns: [
          {
            enableLink: false,
            richText: root([
              heading('h3', 'Representation'),
              p(
                'We advocate for our neighborhood at City Hall \u2014 attending Plan Commission, Common Council, and zoning hearings to ensure far east side residents have a voice in decisions that affect us.',
              ),
            ]),
            size: 'oneThird',
          },
          {
            enableLink: false,
            richText: root([
              heading('h3', 'Information'),
              p(
                'We keep residents informed about development projects, road construction, park improvements, public safety, and city services in our area.',
              ),
            ]),
            size: 'oneThird',
          },
          {
            enableLink: false,
            richText: root([
              heading('h3', 'Community'),
              p(
                'We bring neighbors together through events, shared resources, and communication channels. A connected neighborhood is a stronger neighborhood.',
              ),
            ]),
            size: 'oneThird',
          },
        ],
      },
      {
        blockName: 'Bylaws',
        blockType: 'content',
        columns: [
          {
            richText: root([
              heading('h2', 'Bylaws'),
              heading('h3', 'Article I \u2014 Name'),
              p('This organization shall be known as the Sprecher East Neighborhood Association.'),
              heading('h3', 'Article II \u2014 Boundaries'),
              p(
                'The Sprecher East neighborhood is bounded by I-94 to the north, Door Creek Park to the east, Sprecher Road to the west, and Cottage Grove Road to the south. This includes the Meadowlands, Door Creek, and Reston Heights subdivisions.',
              ),
              heading('h3', 'Article III \u2014 Membership'),
              p(
                'Membership is open to any resident within the boundaries defined in Article II. Membership is free and voluntary. There are no mandatory dues or fees. Each household is entitled to one vote on association matters.',
              ),
            ]),
            size: 'full',
          },
        ],
      },
      {
        blockName: 'Transparency CTA',
        blockType: 'cta',
        links: [
          {
            link: {
              type: 'custom',
              appearance: 'default',
              label: 'FAQ',
              url: '/faq',
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
          heading('h3', 'Transparency'),
          p(
            'We believe in openness. This website is AI-assisted and we\u2019re transparent about that. Have questions? Check our FAQ or reach out directly.',
          ),
        ]),
      },
    ],
    meta: {
      description:
        'Learn about the Sprecher East Neighborhood Association \u2014 our mission, bylaws, and how we represent the far east side of Madison.',
      title: 'The Association',
    },
    title: 'The Association',
  }
}
