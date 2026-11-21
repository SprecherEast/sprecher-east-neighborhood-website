import type { CopiedDocument } from './file'

/**
 * Kept fields whose value is rewritten in the copy (#1396). Only for a field that is public but
 * carries something a preview must not hold, and says why next to it.
 */

type Rewrite = (doc: CopiedDocument) => unknown

/**
 * The byline reads only each author's name. The hook that fills it also stores the author's user
 * id in the row's own `id` column, which would put an account id in a preview and make two posts
 * by one author collide, so each row gets an id of its own from the post.
 */
const byline: Rewrite = (doc) =>
  Array.isArray(doc.populatedAuthors)
    ? doc.populatedAuthors.map((row: { name?: unknown }, index: number) => ({
        id: `${doc.id}-${index}`,
        name: typeof row?.name === 'string' ? row.name : null,
      }))
    : doc.populatedAuthors

const REWRITES: Readonly<Record<string, Readonly<Record<string, Rewrite>>>> = {
  posts: { populatedAuthors: byline },
}

/** The document with its rewritten fields replaced; a field the document lacks is left absent. */
export function reshape(slug: string, doc: CopiedDocument): CopiedDocument {
  const out = { ...doc }
  for (const [field, rewrite] of Object.entries(REWRITES[slug] ?? {})) {
    if (field in out) out[field] = rewrite(doc)
  }
  return out
}
