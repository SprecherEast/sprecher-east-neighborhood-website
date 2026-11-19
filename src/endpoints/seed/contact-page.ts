import type { Form } from '@/payload-types'
import type { RequiredDataFromCollectionSlug } from 'payload'
import { heading, paragraph, text, linkNode, root, p } from './helpers/lexical'

type ContactArgs = {
  contactForm: Form
}

export const contact: (args: ContactArgs) => RequiredDataFromCollectionSlug<'pages'> = ({
  contactForm,
}) => {
  return {
    slug: 'contact',
    _status: 'published',
    hero: {
      type: 'lowImpact',
      richText: root([heading('h1', 'Contact Us')]),
    },
    layout: [
      {
        blockType: 'formBlock',
        enableIntro: true,
        form: contactForm,
        introContent: root([
          heading('h3', 'Send Us a Message'),
          p(
            'Have a question, idea, or concern? Fill out the form below and we\u2019ll get back to you.',
          ),
        ]),
      },
      {
        blockName: 'Quick Links',
        blockType: 'content',
        columns: [
          {
            richText: root([
              heading('h3', 'Other Ways to Connect'),
              paragraph(
                text('Check out our '),
                linkNode('FAQ', '/faq'),
                text(' for answers to common questions, or visit our '),
                linkNode('Resources', '/resources/utilities'),
                text(' page for local contacts and services.'),
              ),
            ]),
            size: 'full',
          },
        ],
      },
    ],
    meta: {
      description:
        'Contact Sprecher East \u2014 send us a message with questions, ideas, or concerns about the neighborhood.',
      title: 'Contact',
    },
    title: 'Contact',
  }
}
