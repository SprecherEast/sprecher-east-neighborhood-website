import { slugify } from 'payload/shared'

/** `Café & the "Big" Plan` → `cafe-the-big-plan`: accents folded to their letters, not dropped */
export const anchorId = (text: string): string =>
  slugify(
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' '),
  )
    ?.replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '') || 'section'
