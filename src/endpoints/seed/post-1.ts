import type { Media, User } from '@/payload-types'
import type { RequiredDataFromCollectionSlug } from 'payload'
import { heading, root, p } from './helpers/lexical'

export type PostArgs = {
  heroImage: Media
  author: User
}

// "Sprecher East Is Coming Together" — Amine's founder post
export const post1: (args: PostArgs) => RequiredDataFromCollectionSlug<'posts'> = ({
  heroImage,
  author,
}) => {
  return {
    slug: 'sprecher-east-is-coming-together',
    _status: 'published',
    authors: [author],
    content: root([
      heading(
        'h2',
        'One person, a bunch of AI agents, and a dream to build real community on Madison\u2019s Far East Side.',
      ),
      p(
        'Hey neighbor. I\u2019m Amine, and I live right here in the Sprecher East area on Madison\u2019s Far East Side. You probably know the feeling \u2014 you wave at the same people walking their dogs, you see the same faces at the park, but somehow we never really connect.',
      ),
      p(
        'Sprecher East is an unofficial neighborhood site. No corporate backing, no government mandate, no HOA board sending you angry letters about your fence height. Just one neighbor who decided to stop waiting and start building.',
      ),
      p(
        'Here\u2019s the honest truth: right now, this is mostly me and a team of AI tools. Yes, AI. I use AI agents to help research, write, build this website, and keep things organized. I\u2019m completely transparent about that because I believe trust is built on honesty, not appearances.',
      ),
      heading('h2', 'What We\u2019re Building'),
      p(
        'A neighborhood association that speaks up for our area at City Hall, if enough neighbors want one. A website with events, news, and resources that actually matter to us. Community connections that go deeper than a Nextdoor post. A voice for District 16 residents who feel like the far east side gets forgotten.',
      ),
      heading('h2', 'What We Need From You'),
      p(
        'Show up \u2014 come to a meeting, say hi, bring a friend. Speak up \u2014 got a neighborhood concern? An idea? We want to hear it. Spread the word \u2014 tell your neighbors. Volunteer \u2014 even an hour a month makes a real difference.',
      ),
      p(
        'We\u2019re not official yet \u2014 registration with the City of Madison takes time. But the community we\u2019re building? That\u2019s already real. And it starts with you.',
      ),
      p('Let\u2019s do this together.'),
    ]),
    heroImage: heroImage.id,
    meta: {
      description:
        'One person, a bunch of AI agents, and a dream to build real community on Madison\u2019s Far East Side. Here\u2019s why Sprecher East exists \u2014 and why we need you.',
      image: heroImage.id,
      title: 'Sprecher East Is Coming Together',
    },
    publishedAt: '2026-02-28T12:00:00.000Z',
    relatedPosts: [],
    title: 'Sprecher East Is Coming Together',
  }
}
