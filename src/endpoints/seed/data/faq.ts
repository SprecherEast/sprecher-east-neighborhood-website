import type { FaqCategory } from '@/modules/directory'

import { root, paragraph, text, linkNode, p } from '../helpers/lexical'

type FAQItem = {
  question: string
  answer: ReturnType<typeof root>
  category: FaqCategory
  order: number
}

export const faqItems: FAQItem[] = [
  {
    question: 'What is Sprecher East?',
    answer: root([
      p(
        'An unofficial site for the neighborhood on Madison’s Far East Side: Meadowlands, Door Creek and Reston Heights. We share news, events and City updates in one place.',
      ),
    ]),
    category: 'general',
    order: 1,
  },
  {
    question: 'Is Sprecher East an official neighborhood association?',
    answer: root([
      p('No. This is an unofficial site run by one neighbor. It doesn’t speak for any association.'),
    ]),
    category: 'general',
    order: 2,
  },
  {
    question: 'Is this the same as the Meadowlands HOA?',
    answer: root([
      p(
        'No. Sprecher East is not a homeowners association (HOA). We collect no dues, set no rules about your property and have no enforcement power.',
      ),
    ]),
    category: 'general',
    order: 3,
  },
  {
    question: 'Do I need to join or pay?',
    answer: root([
      paragraph(
        text(
          'No. There’s no membership, no sign-up and no dues. Read the site, and ',
        ),
        linkNode('send us a note', '/contact'),
        text(' if you’d like to share something or help.'),
      ),
    ]),
    category: 'general',
    order: 4,
  },
  {
    question: 'Who runs this?',
    answer: root([
      paragraph(
        text('Amine Boulaajaj, a neighbor here, with AI tools doing research and drafting. The '),
        linkNode('About page', '/about'),
        text(' has more.'),
      ),
    ]),
    category: 'general',
    order: 5,
  },
  {
    question: 'Does AI help build this website?',
    answer: root([
      p(
        'Yes. We use AI tools to research, draft and organize what’s here. A neighbor reviews what gets published, and longer pieces say what they’re based on.',
      ),
    ]),
    category: 'general',
    order: 6,
  },
  {
    question: 'What can I do to help?',
    answer: root([
      p(
        'Tell us what you need, point out what’s wrong, share an event, or pass the site on to a neighbor. Even a minute helps.',
      ),
    ]),
    category: 'general',
    order: 7,
  },
  {
    question: 'How do I report a neighborhood issue?',
    answer: root([
      paragraph(
        text('For City services (potholes, streetlights, noise), use the City’s '),
        linkNode('Report a Problem', 'https://www.cityofmadison.com/reportaproblem/', {
          newTab: true,
        }),
        text(' tool. For anything else about the neighborhood, use our '),
        linkNode('contact form', '/contact'),
        text('.'),
      ),
    ]),
    category: 'neighborhood',
    order: 8,
  },
  {
    question: 'How is Sprecher East different from Nextdoor?',
    answer: root([
      p(
        'Nextdoor is a social media platform owned by a corporation. Sprecher East is a neighbor-run site about our neighborhood’s news, events and City updates. We’re your neighbors, not an app.',
      ),
    ]),
    category: 'general',
    order: 9,
  },
]
