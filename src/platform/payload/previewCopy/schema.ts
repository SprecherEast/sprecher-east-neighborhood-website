import type { CollectionSlug, Payload } from 'payload'

import { PREVIEW_COPY, SYSTEM_FIELDS, UPLOAD_FIELDS } from './classification'
import type { BlockDef } from './references'

/** What the export and the import read from the running config, written once (#1396). */

export type Schema = {
  fields: unknown[]
  upload?: unknown
  versions?: { drafts?: unknown } | false
}

/** The config of a collection or a global, and which of the two it is; throws for neither. */
export function schemaOf(payload: Payload, slug: string): { config: Schema; isGlobal: boolean } {
  const collection = payload.collections[slug as CollectionSlug]
  if (collection) return { config: collection.config as unknown as Schema, isGlobal: false }
  const global = payload.globals.config.find((candidate) => candidate.slug === slug)
  if (global) return { config: global as unknown as Schema, isGlobal: true }
  throw new Error(`Preview copy: "${slug}" is not in this build's config`)
}

/** Finds a block by slug in the config's shared blocks, for block references. */
export const blockLookup = (payload: Payload) => (slug: string) =>
  (payload.blocks as Record<string, BlockDef | undefined> | undefined)?.[slug]

/** The top-level fields a copied document may carry: the ones classified `keep`, and the system and file ones. */
export function allowedFields(slug: string, schema: Schema): Set<string> {
  const entry = PREVIEW_COPY[slug]
  if (entry?.copy !== 'copied') throw new Error(`Preview copy: "${slug}" is not copied`)
  return new Set([...entry.keep, ...SYSTEM_FIELDS, ...(schema.upload ? UPLOAD_FIELDS : [])])
}
