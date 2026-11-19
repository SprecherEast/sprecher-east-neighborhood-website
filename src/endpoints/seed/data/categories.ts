import { eventCategories } from './events'

/** Categories for news posts: civic updates get their own, apart from neighborhood news (#483). */
const newsCategories = {
  'city-council': 'City council',
} as const

/** Every category the seed creates, by slug: the events' and the news posts'. */
export const seedCategories = { ...eventCategories, ...newsCategories } as const
