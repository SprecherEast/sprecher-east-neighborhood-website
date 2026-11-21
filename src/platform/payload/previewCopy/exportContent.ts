import type { CollectionSlug, GlobalSlug, Payload } from 'payload'

import { copiedSlugs, PREVIEW_COPY } from './classification'
import {
  type CopiedDocument,
  isSafeFileName,
  PREVIEW_COPY_FORMAT,
  type PreviewCopyFile,
} from './file'
import { type Reference, walkReferences } from './references'
import { allowedFields, blockLookup, schemaOf } from './schema'

/**
 * The privileged half of the preview copy (#1396, part of #1077): reads a production snapshot and
 * returns what the classification allows, and nothing else. It runs from `main`'s code, never the
 * pull request's, and it is read-only.
 *
 * Every read is the Local API as an anonymous visitor: access is checked and there is no user, so
 * a draft, an unpublished document and a staff-only field never come back, and a field that reads
 * through a relationship comes back as a visitor would see it. A document is then cut down to the
 * fields classified `keep`, so a property a collection hook adds is dropped. References are
 * followed only to documents this export copies itself: media a copied document points at, and
 * other copied documents by id; anything else is removed, never read.
 */

const PAGE_SIZE = 100
const MEDIA = 'media'

export type ExportCounts = {
  documents: Record<string, number>
  droppedReferences: number
}

/** What the export reads as a visitor does. No `user`: a user is what would widen it. */
const AS_VISITOR = { overrideAccess: false, depth: 0, draft: false } as const

function pick(doc: Record<string, unknown>, allowed: ReadonlySet<string>): CopiedDocument {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(doc)) if (allowed.has(key)) out[key] = doc[key]
  return out as CopiedDocument
}

export async function exportPreviewCopy(
  payload: Payload,
): Promise<{ file: PreviewCopyFile; counts: ExportCounts }> {
  const slugs = copiedSlugs()
  const configOf = (slug: string) => schemaOf(payload, slug)

  const documents: Record<string, CopiedDocument[]> = {}
  const globals: Record<string, CopiedDocument> = {}

  // Everything but media is copied whole (what a visitor reads); media only once something points at it
  for (const slug of slugs.filter((s) => s !== MEDIA)) {
    const { config, isGlobal } = configOf(slug)
    const entry = PREVIEW_COPY[slug]
    if (entry?.copy !== 'copied') continue
    const hasDrafts = Boolean(config.versions && config.versions.drafts)
    if (hasDrafts && entry.reads !== 'published') {
      throw new Error(`Preview copy: "${slug}" has drafts but is not read as published only`)
    }
    const allowed = allowedFields(slug, config)
    if (isGlobal) {
      const doc = await payload.findGlobal({ slug: slug as GlobalSlug, ...AS_VISITOR })
      globals[slug] = pick(doc as unknown as Record<string, unknown>, allowed)
      continue
    }
    documents[slug] = []
    for (let page = 1; ; page += 1) {
      const result = await payload.find({
        collection: slug as CollectionSlug,
        ...AS_VISITOR,
        limit: PAGE_SIZE,
        page,
        sort: 'id',
      })
      for (const doc of result.docs) {
        documents[slug].push(pick(doc as unknown as Record<string, unknown>, allowed))
      }
      if (!result.hasNextPage) break
    }
  }

  const blocks = blockLookup(payload)
  const walk = (slug: string, data: Record<string, unknown>, keep: (r: Reference) => boolean) =>
    walkReferences({ fields: configOf(slug).config.fields as never, data, blocks, keep })

  // First pass: which media do the copied documents point at?
  const wanted = new Set<string>()
  const noteMedia = ({ relationTo, id }: Reference) => {
    if (relationTo === MEDIA) wanted.add(String(id))
    return true
  }
  for (const [slug, docs] of Object.entries(documents)) {
    for (const doc of docs) walk(slug, doc, noteMedia)
  }
  for (const [slug, doc] of Object.entries(globals)) walk(slug, doc, noteMedia)

  // The media themselves, read as a visitor like the rest
  if (slugs.includes(MEDIA)) {
    const config = configOf(MEDIA).config
    const allowed = allowedFields(MEDIA, config)
    documents[MEDIA] = []
    const ids = [...wanted]
    for (let start = 0; start < ids.length; start += PAGE_SIZE) {
      const result = await payload.find({
        collection: MEDIA as CollectionSlug,
        ...AS_VISITOR,
        where: { id: { in: ids.slice(start, start + PAGE_SIZE) } },
        limit: PAGE_SIZE,
        sort: 'id',
      })
      for (const doc of result.docs) {
        documents[MEDIA].push(pick(doc as unknown as Record<string, unknown>, allowed))
      }
    }
  }

  // Second pass: a reference stays only when it points at a document that is in the file
  const present = new Map(
    Object.entries(documents).map(([slug, docs]) => [slug, new Set(docs.map((d) => String(d.id)))]),
  )
  let droppedReferences = 0
  const keepCopied = ({ relationTo, id }: Reference) =>
    present.get(relationTo)?.has(String(id)) ?? false
  for (const [slug, docs] of Object.entries(documents)) {
    documents[slug] = docs.map((doc) => {
      const result = walk(slug, doc, keepCopied)
      droppedReferences += result.dropped
      return result.data as CopiedDocument
    })
  }
  for (const [slug, doc] of Object.entries(globals)) {
    const result = walk(slug, doc, keepCopied)
    droppedReferences += result.dropped
    globals[slug] = result.data as CopiedDocument
  }

  const file: PreviewCopyFile = {
    format: PREVIEW_COPY_FORMAT,
    collections: documents,
    globals,
    mediaFiles: mediaFileNames(documents[MEDIA] ?? []),
  }
  const counts = {
    documents: Object.fromEntries(Object.entries(documents).map(([s, d]) => [s, d.length])),
    droppedReferences,
  }
  return { file, counts }
}

/** The file names of each picture and its sizes, sorted, refusing any that could leave the folder. */
function mediaFileNames(media: CopiedDocument[]): string[] {
  const names = new Set<string>()
  for (const doc of media) {
    const sizes = typeof doc.sizes === 'object' && doc.sizes !== null ? doc.sizes : {}
    const found = [
      doc.filename,
      ...Object.values(sizes).map((size) => (size as { filename?: unknown })?.filename),
    ]
    for (const name of found) {
      if (name === null || name === undefined) continue
      if (!isSafeFileName(name))
        throw new Error('Preview copy: a media record has an unsafe file name')
      names.add(name)
    }
  }
  return [...names].sort()
}
