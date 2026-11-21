import {
  type PreviewCopyEntry,
  PREVIEW_COPY,
  SYSTEM_FIELDS,
  UPLOAD_FIELDS,
} from '../previewCopy/classification'
import { accessResult } from './accessHarness'
import { createFieldWalker, type FieldNode } from './configFields'

/**
 * The gate behind the preview copy allowlist (#1395): compares the Payload config with the
 * classification and returns what is wrong, one line each. No database. It reads the config
 * object only, so it is a test helper and never runs on the server.
 */

type Node = FieldNode
type Owner = {
  slug: string
  fields: unknown[]
  versions?: unknown
  upload?: unknown
  access?: { read?: unknown }
}

const looksLikeEmail = (field: Node) => field.type === 'email' || /e-?mail/i.test(field.name ?? '')

/**
 * True when a visitor may not read the field. A preview's database is as open as its code, so
 * the test is what an anonymous visitor sees, never what a signed-in role sees.
 */
async function staffOnly(field: Node): Promise<boolean> {
  if (!field.access?.read) return false
  return (await accessResult(field.access.read, 'visitor')) === false
}

/** Why a top-level field is not clearly public, or null when it is. */
async function privacyReason(fields: Node[]): Promise<string | null> {
  for (const field of fields) {
    if (looksLikeEmail(field)) return `holds an email field (${field.name ?? field.type})`
    if (field.hidden) return `has a hidden field (${field.name})`
    if (await staffOnly(field)) return `has a staff-only read field (${field.name})`
  }
  return null
}

const PUBLISHED_FILTER = JSON.stringify({ _status: { equals: 'published' } })

/** What a visitor's read of the collection gives: nothing, everything, or only the published. */
async function visitorRead(read: unknown): Promise<'none' | 'all' | 'published' | 'other'> {
  const result = await accessResult(read, 'visitor')
  if (result === false) return 'none'
  if (result === true) return 'all'
  return JSON.stringify(result) === PUBLISHED_FILTER ? 'published' : 'other'
}

const hasDraftsOf = (owner: Owner) =>
  typeof owner.versions === 'object' &&
  owner.versions !== null &&
  Boolean((owner.versions as { drafts?: unknown }).drafts)

export async function findClassificationProblems(
  config: { collections: Owner[]; globals: Owner[]; blocks?: unknown[] },
  classification: Readonly<Record<string, PreviewCopyEntry>> = PREVIEW_COPY,
): Promise<string[]> {
  const problems: string[] = []
  const owners = [...config.collections, ...config.globals]
  const slugs = new Set(owners.map((o) => o.slug))
  const walker = createFieldWalker({
    collections: config.collections,
    blocks: config.blocks as never,
  })

  for (const slug of Object.keys(classification)) {
    if (!slugs.has(slug)) problems.push(`${slug}: classified, but not in the config any more`)
  }
  for (const owner of owners) {
    const entry = classification[owner.slug]
    if (!entry) {
      problems.push(`${owner.slug}: not classified (add it to PREVIEW_COPY)`)
      continue
    }
    if (entry.reason.trim().length < 10) problems.push(`${owner.slug}: needs a reason`)
    if (entry.copy !== 'copied') continue

    // Copied documents are readable by anyone in a preview, so the collection must be public
    const read = await visitorRead(owner.access?.read)
    if (read === 'none') {
      problems.push(`${owner.slug}: copied, but a visitor may not read it on the site`)
    } else if (read === 'other') {
      problems.push(
        `${owner.slug}: a visitor's read is filtered by something other than published, so a copy of every row would show rows a visitor never sees`,
      )
    } else if (read === 'published' && entry.reads !== 'published') {
      problems.push(
        `${owner.slug}: a visitor reads the published version only, so reads must say so`,
      )
    }

    if (hasDraftsOf(owner) && entry.reads !== 'published') {
      problems.push(`${owner.slug}: has drafts, so it must read the published version only`)
    }

    const tops = walker.topLevelFields(owner.fields as Node[])
    for (const unknown of walker.drainProblems()) {
      problems.push(`${owner.slug}: the gate cannot read its fields (${unknown})`)
    }
    // An upload collection adds its file fields at run time; they are copied with the record
    const implicit: readonly string[] = owner.upload
      ? [...SYSTEM_FIELDS, ...UPLOAD_FIELDS]
      : SYSTEM_FIELDS
    const names = new Set(tops.map((f) => f.name))
    const listed = new Set<string>([...entry.keep, ...entry.clear])
    for (const name of listed) {
      if (!names.has(name)) problems.push(`${owner.slug}.${name}: listed, but not a field any more`)
    }
    for (const name of entry.keep) {
      if (entry.clear.includes(name)) problems.push(`${owner.slug}.${name}: kept and cleared`)
    }
    for (const top of tops) {
      const name = top.name as string
      if (implicit.includes(name)) continue
      if (!listed.has(name)) {
        problems.push(`${owner.slug}.${name}: new field, decide keep or clear`)
        continue
      }
      if (!entry.keep.includes(name)) continue
      const below = [top, ...walker.descendants(top)]
      const why = await privacyReason(below)
      if (why) problems.push(`${owner.slug}.${name}: kept, but it ${why}; it must be cleared`)
      for (const field of below) {
        for (const target of walker.targets(field)) {
          const problem = `${owner.slug}.${name}: kept, but it points at ${target}, which is not copied`
          if (classification[target]?.copy !== 'copied' && !problems.includes(problem)) {
            problems.push(problem)
          }
        }
      }
      // Anything the walker did not recognise could hide a field: fail, never skip
      for (const unknown of walker.drainProblems()) {
        problems.push(`${owner.slug}.${name}: kept, but the gate cannot read it (${unknown})`)
      }
    }
  }
  return problems
}
