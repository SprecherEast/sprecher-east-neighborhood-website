/** Small synthetic configs and classifications for the preview copy gate tests (#1395). */

export const field = (name: string, extra: object = {}) => ({ name, type: 'text', ...extra })
export const open = () => true
export const configOf = (fields: unknown[], extra: object = {}) => ({
  collections: [{ slug: 'things', fields, access: { read: open }, ...extra }],
  globals: [],
})
export const entry = (
  keep: string[],
  clear: string[] = [],
  reads: 'all' | 'published' = 'all',
) => ({
  things: { copy: 'copied' as const, reason: 'A test collection.', keep, clear, reads },
})
