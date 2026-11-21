import { copiedSlugs } from './classification'
import { isObject } from './references'

/**
 * The one file between the export (run from `main`'s code on a snapshot) and the import (run by
 * the pull request's own code, which reads nothing else), #1396. The import trusts nothing in
 * it: `parsePreviewCopyFile` checks its shape and what the classification allows, so a file
 * made by anything else is refused before a document is written.
 */

export const PREVIEW_COPY_FORMAT = 1

export type CopiedDocument = Record<string, unknown> & { id: string | number }

export type PreviewCopyFile = {
  format: typeof PREVIEW_COPY_FORMAT
  /** Collection slug to its copied documents, with ids and relationships as ids. */
  collections: Record<string, CopiedDocument[]>
  /** Global slug to its copied data. */
  globals: Record<string, Record<string, unknown>>
  /** File names of the pictures the copied media records point at (each size too). */
  mediaFiles: string[]
}

/**
 * A name inside the media folder and nothing else: no path, no parent segment, no control
 * character. The server step links these files, so a name must not be able to leave the folder.
 */
export function isSafeFileName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= 255 &&
    !name.startsWith('.') &&
    // A leading dash would read as an option to a command that links the file
    !name.startsWith('-') &&
    !/[/\\\u0000-\u001f\u007f]/.test(name)
  )
}

/** The file names one media record points at: the file itself and each size; any unsafe one throws. */
export function mediaFileNames(doc: Record<string, unknown>): string[] {
  const sizes = isObject(doc.sizes) ? doc.sizes : {}
  const found = [
    doc.filename,
    ...Object.values(sizes).map((size) => isObject(size) && size.filename),
  ]
  return found.flatMap((name) => {
    if (name === null || name === undefined || name === false) return []
    if (!isSafeFileName(name))
      throw new Error('Preview copy: a media record has an unsafe file name')
    return [name]
  })
}

/** Reads the file's text. Throws a plain message, never the content, when anything is off. */
export function parsePreviewCopyFile(text: string): PreviewCopyFile {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Preview copy file: not JSON')
  }
  if (!isObject(value) || value.format !== PREVIEW_COPY_FORMAT) {
    throw new Error('Preview copy file: unknown format')
  }
  const allowed = new Set(copiedSlugs())
  const { collections, globals, mediaFiles } = value
  if (!isObject(collections) || !isObject(globals) || !Array.isArray(mediaFiles)) {
    throw new Error('Preview copy file: missing collections, globals or media files')
  }
  for (const [slug, docs] of Object.entries(collections)) {
    if (!allowed.has(slug)) throw new Error(`Preview copy file: "${slug}" is not copied`)
    const valid =
      Array.isArray(docs) &&
      docs.every(
        (doc) => isObject(doc) && (typeof doc.id === 'string' || typeof doc.id === 'number'),
      )
    if (!valid) throw new Error(`Preview copy file: "${slug}" holds a document without an id`)
  }
  for (const [slug, doc] of Object.entries(globals)) {
    if (!allowed.has(slug) || !isObject(doc)) {
      throw new Error(`Preview copy file: "${slug}" is not copied`)
    }
  }
  if (!mediaFiles.every(isSafeFileName))
    throw new Error('Preview copy file: unsafe media file name')
  // A preview that deletes a media record unlinks its file names, so each record's own must be safe too
  for (const doc of Array.isArray(collections.media) ? collections.media : []) mediaFileNames(doc)
  return value as unknown as PreviewCopyFile
}
