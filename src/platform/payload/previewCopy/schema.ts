import type { CollectionSlug, Payload } from 'payload'

import { PREVIEW_COPY, SYSTEM_FIELDS, UPLOAD_FIELDS } from './classification'
import type { CopiedDocument } from './file'
import { type BlockDef, type KeepReference, walkReferences } from './references'

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

/** Keeps only the allowed keys of a document, and counts the ones left out. */
export function cutToFields(
  doc: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): { doc: CopiedDocument; skipped: number } {
  const out: Record<string, unknown> = {}
  let skipped = 0
  for (const key of Object.keys(doc)) {
    if (allowed.has(key)) out[key] = doc[key]
    else skipped += 1
  }
  return { doc: out as CopiedDocument, skipped }
}

/** A copy of the document without the references `keep` refuses, read by this build's own fields. */
export function walkDocument(
  payload: Payload,
  slug: string,
  data: Record<string, unknown>,
  keep: KeepReference,
) {
  return walkReferences({
    fields: schemaOf(payload, slug).config.fields as never,
    data,
    blocks: blockLookup(payload),
    keep,
  })
}
