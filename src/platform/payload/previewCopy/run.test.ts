import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPayload } from 'payload'

import { copyFilePath, exportToFile, openQuietly, runPreviewCopyStep } from './run'

/** The wrapper around the export and import scripts (#1396). */

vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({})) }))
vi.mock('./exportContent', () => ({
  exportPreviewCopy: vi.fn(async () => ({
    file: { format: 1, collections: {}, globals: {}, mediaFiles: [] },
    counts: { documents: { posts: 2 }, droppedReferences: 1 },
  })),
}))

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'preview-copy-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('exportToFile', () => {
  it('writes a file only its owner can read, and says what it wrote in numbers', async () => {
    const path = join(dir, 'copy.json')
    const { summary } = await exportToFile({} as never, path)
    expect(summary).toBe('exported posts 2; 1 references left out')
    expect(JSON.parse(await readFile(path, 'utf8')).format).toBe(1)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
  })

  it('never writes over a file that exists', async () => {
    const path = join(dir, 'copy.json')
    await writeFile(path, 'keep me')
    await expect(exportToFile({} as never, path)).rejects.toThrow()
    expect(await readFile(path, 'utf8')).toBe('keep me')
  })
})

describe('runPreviewCopyStep', () => {
  const log = () => ({ info: vi.fn(), error: vi.fn() })

  it('prints the summary and exits 0', async () => {
    const out = log()
    expect(
      await runPreviewCopyStep('import', async () => ({ summary: 'imported posts 2' }), out),
    ).toBe(0)
    expect(out.info).toHaveBeenCalledWith('preview copy: imported posts 2')
  })

  it('prints one fixed line on a failure, never the error', async () => {
    const out = log()
    const code = await runPreviewCopyStep(
      'export',
      async () => {
        throw new Error('SQLITE: ana@example.com')
      },
      out,
    )
    expect(code).toBe(1)
    expect(out.error).toHaveBeenCalledTimes(1)
    expect(String(out.error.mock.calls[0]?.[0])).toBe(
      'preview copy: the export failed (details are not shown: the log is public)',
    )
  })
})

describe('copyFilePath', () => {
  it('needs the variable', () => {
    expect(copyFilePath({ PREVIEW_COPY_FILE: '/tmp/x.json' })).toBe('/tmp/x.json')
    expect(() => copyFilePath({})).toThrow(/PREVIEW_COPY_FILE/)
  })
})

describe('openQuietly', () => {
  it("opens Payload with its own logger off, so a failure's message never reaches the public log", async () => {
    await openQuietly(Promise.resolve({ serverURL: 'x' } as never))
    const [opened] = vi.mocked(getPayload).mock.calls
    const { config } = opened?.[0] as unknown as {
      config: { serverURL: string; logger: { options: { enabled: boolean } } }
    }
    expect(config.serverURL).toBe('x')
    expect(config.logger.options.enabled).toBe(false)
  })
})
