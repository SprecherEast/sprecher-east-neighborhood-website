import { chmod, readFile, writeFile } from 'node:fs/promises'

import type { Payload } from 'payload'

import { exportPreviewCopy, type ExportCounts } from './exportContent'
import { parsePreviewCopyFile } from './file'
import { type ImportCounts, importPreviewCopy } from './importContent'
import { reindexSearch } from './reindexSearch'

/**
 * What the two `payload run` scripts do (#1396): `e2e/previewCopyExport.ts` and
 * `e2e/previewCopyImport.ts` open Payload and call these. The ops step that runs them, and checks
 * which tree each runs from, is a separate issue.
 *
 * A deploy log is public, and an error from Payload or the database carries its own text, which
 * could hold a value. So a failure prints one fixed line and the exit code, and a success prints
 * numbers only.
 */

const FAILED = (step: string) =>
  `preview copy: the ${step} failed (details are not shown: the log is public)`

const numbers = (counts: Record<string, number>) =>
  Object.entries(counts)
    .map(([name, count]) => `${name} ${count}`)
    .join(', ')

/** Writes the file for the import: private to its owner, and never over a file that exists. */
export async function exportToFile(
  payload: Payload,
  path: string,
): Promise<{ counts: ExportCounts; summary: string }> {
  const { file, counts } = await exportPreviewCopy(payload)
  await writeFile(path, JSON.stringify(file), { flag: 'wx', mode: 0o600 })
  // The creation mode is cut by the process's umask; say it again
  await chmod(path, 0o600)
  return {
    counts,
    summary: `exported ${numbers(counts.documents)}; ${counts.droppedReferences} references left out`,
  }
}

/** Reads only the file, writes it into the empty database, and rebuilds the search index. */
export async function importFromFile(
  payload: Payload,
  path: string,
): Promise<{ counts: ImportCounts; summary: string }> {
  const file = parsePreviewCopyFile(await readFile(path, 'utf8'))
  const counts = await importPreviewCopy(payload, file)
  await reindexSearch(payload)
  return {
    counts,
    summary: `imported ${numbers(counts.created)}; ${counts.skippedFields} fields no longer in the schema skipped`,
  }
}

/** Runs one step and returns its exit code; the summary goes to `log`, a failure's fixed line to `fail`. */
export async function runPreviewCopyStep(
  step: 'export' | 'import',
  work: () => Promise<{ summary: string }>,
  log: Pick<Console, 'info' | 'error'> = console,
): Promise<number> {
  try {
    const { summary } = await work()
    log.info(`preview copy: ${summary}`)
    return 0
  } catch {
    log.error(FAILED(step))
    return 1
  }
}

/** The file's path from the environment; a step that has none fails rather than guessing. */
export function copyFilePath(env: Record<string, string | undefined> = process.env): string {
  const path = env.PREVIEW_COPY_FILE
  if (!path) throw new Error('PREVIEW_COPY_FILE is not set')
  return path
}
