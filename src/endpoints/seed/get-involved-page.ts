import type { RequiredDataFromCollectionSlug } from 'payload'
import { heading, root, p } from './helpers/lexical'

export const getInvolvedPage: () => RequiredDataFromCollectionSlug<'pages'> = () => {
  return {
    slug: 'get-involved',
    _status: 'published',
    hero: {
      type: 'lowImpact',
      richText: root([heading('h1', 'Get Involved')]),
    },
    layout: [
      {
        blockName: 'Intro',
        blockType: 'content',
        columns: [
          {
            richText: root([
              heading('h2', 'Help this site'),
              p(
                'There\u2019s no membership, no sign-up and no dues. Tell us what you need, point out what\u2019s wrong, and pass it on.',
              ),
              p(
                'Your help keeps neighbors informed, from development decisions at City Hall to events right here at home.',
              ),
            ]),
            size: 'full',
          },
        ],
      },
      {
        blockName: 'Benefits',
        blockType: 'content',
        columns: [
          {
            richText: root([heading('h2', 'Why Get Involved?')]),
            size: 'full',
          },
          {
            enableLink: false,
            richText: root([
              heading('h3', 'Have a Voice'),
              p('Your voice matters at Plan Commission, Common Council and zoning hearings.'),
            ]),
            size: 'oneThird',
          },
          {
            enableLink: false,
            richText: root([
              heading('h3', 'Stay Informed'),
              p(
                'Get updates on development projects, road construction, park improvements, and city services that affect our area.',
              ),
            ]),
            size: 'oneThird',
          },
          {
            enableLink: false,
            richText: root([
              heading('h3', 'Connect with Neighbors'),
              p(
                'Meet the people who live around you. Community events, online forums, and neighborhood projects bring us together.',
              ),
            ]),
            size: 'oneThird',
          },
        ],
      },
      {
        blockName: 'Ways to Help',
        blockType: 'content',
        columns: [
          {
            richText: root([heading('h2', 'Ways to Help')]),
            size: 'full',
          },
          {
            enableLink: false,
            richText: root([
              heading('h3', 'Come to an Event'),
              p(
                'City meetings and many events are open to all neighbors. Come listen, ask questions or share an idea.',
              ),
            ]),
            size: 'oneThird',
          },
          {
            enableLink: false,
            richText: root([
              heading('h3', 'Volunteer'),
              p(
                'Help with events, website content, outreach, or neighborhood clean-ups. Even an hour a month makes a difference.',
              ),
            ]),
            size: 'oneThird',
          },
          {
            enableLink: false,
            richText: root([
              heading('h3', 'Spread the Word'),
              p('Tell your neighbors about this site. Share it, or invite someone to an event.'),
            ]),
            size: 'oneThird',
          },
        ],
      },
      {
        blockName: 'Ready CTA',
        blockType: 'cta',
        links: [
          {
            link: {
              type: 'custom',
              appearance: 'default',
              label: 'Contact Us',
              url: '/contact',
            },
          },
          {
            link: {
              type: 'custom',
              appearance: 'outline',
              label: 'Upcoming Events',
              url: '/events',
            },
          },
        ],
        richText: root([
          heading('h3', 'Ready to Get Involved?'),
          p('Reach out to us or come to our next event. We\u2019d love to meet you.'),
        ]),
      },
    ],
    meta: {
      description:
        'Ways to help this unofficial Sprecher East site: tell us what you need, point out what\u2019s wrong, and pass it on.',
      title: 'Get Involved',
    },
    title: 'Get Involved',
  }
}
