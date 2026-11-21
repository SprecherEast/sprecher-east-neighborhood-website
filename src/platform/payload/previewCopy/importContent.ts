import type { CollectionSlug, GlobalSlug, Payload } from 'payload'

import { SYSTEM_FIELDS, UPLOAD_FIELDS } from './classification'
import type { PreviewCopyFile } from './file'
import { namedFields, type Reference } from './references'
import { allowedFields, cutToFields, schemaOf, walkDocument } from './schema'

/**
 * The half of the preview copy that the pull request's own code runs, after its migrations
 * (#1396, part of #1077). It reads only the file the export wrote, never the snapshot, and writes
 * through the database adapter's `create`, which runs no hook: no email, no cache refresh, no
 * search entry. Ids are kept so relationships still point at the same documents.
 *
 * A field the pull request's schema no longer has, or its classification does not keep, is left
 * out and counted. The counts are numbers only, safe for a public comment.
 */

export type ImportCounts = {
  created: Record<string, number>
  skippedFields: number
}

type Doc = Record<string, unknown>

export async function importPreviewCopy(
  payload: Payload,
  file: PreviewCopyFile,
): Promise<ImportCounts> {
  const counts: ImportCounts = { created: {}, skippedFields: 0 }
  const configOf = (slug: string) => schemaOf(payload, slug).config

  /** Only fields this build has and its classification keeps; anything else is counted and dropped. */
  const supported = (slug: string): Set<string> => {
    const config = configOf(slug)
    const schema = new Set(
      namedFields(config.fields as never).flatMap((field) => (field.name ? [field.name] : [])),
    )
    const implicit: readonly string[] = [...SYSTEM_FIELDS, ...UPLOAD_FIELDS]
    return new Set(
      [...allowedFields(slug, config)].filter((n) => schema.has(n) || implicit.includes(n)),
    )
  }
  const trim = (doc: Doc, allowed: Set<string>): Doc => {
    const { doc: kept, skipped } = cutToFields(doc, allowed)
    counts.skippedFields += skipped
    return kept
  }
  const walk = (slug: string, data: Doc, keep: (reference: Reference) => boolean) =>
    walkDocument(payload, slug, data, keep).data

  // Which documents exist so far: a reference to one that does not exist yet waits for a second pass
  const created = new Set<string>()
  const key = ({ relationTo, id }: Reference) => `${relationTo}:${id}`
  const later: { slug: string; doc: Doc }[] = []

  // Media first: most documents point at it, so they need no second pass for it
  const ordered = Object.entries(file.collections).sort(
    ([a], [b]) => Number(b === 'media') - Number(a === 'media'),
  )
  for (const [slug, docs] of ordered) {
    const allowed = supported(slug)
    counts.created[slug] = 0
    for (const raw of docs) {
      const doc = trim(raw, allowed)
      let waits = false
      const first = walk(slug, doc, (reference) => {
        const exists = created.has(key(reference)) || key(reference) === `${slug}:${doc.id}`
        if (!exists) waits = true
        return exists
      })
      // `customID` keeps the id; without it the adapter numbers the row itself
      await payload.db.create({
        collection: slug as CollectionSlug,
        customID: doc.id as never,
        data: first as never,
      })
      created.add(`${slug}:${doc.id}`)
      counts.created[slug] += 1
      if (waits) later.push({ slug, doc })
    }
  }
  // Second pass: every document exists now, so each can point at any other
  for (const { slug, doc } of later) {
    await payload.db.updateOne({
      collection: slug as CollectionSlug,
      id: doc.id as string | number,
      // Walked again: a reference to something the file lacks is still left out
      data: walk(slug, doc, (reference) => created.has(key(reference))) as never,
    })
  }

  for (const [slug, raw] of Object.entries(file.globals)) {
    const doc = walk(slug, trim(raw, supported(slug)), (reference) => created.has(key(reference)))
    await payload.db.createGlobal({ slug: slug as GlobalSlug, data: doc as never })
  }
  return counts
}
