import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

import { bootPayload } from '@/platform/payload/testing/inMemoryPayload'

import { openQuietly } from './run'

/** The scripts' log is public, so Payload's own logger must say nothing (#1396). */

describe('openQuietly', () => {
  it('opens real Payload with its logger silent, whatever the site config says', async () => {
    const { config } = await bootPayload()
    const payload = await openQuietly(config, 'preview-copy-quiet')
    expect(payload.logger.level).toBe('silent')
    expect(payload.logger.isLevelEnabled('fatal')).toBe(false)
  }, 120_000)
})

describe('the export script', () => {
  it('prints one fixed line and exits 1 when the database cannot be opened', async () => {
    const env = {
      ...process.env,
      PREVIEW_COPY_FILE: '/tmp/preview-copy-never-written.json',
      DATABASE_URI: 'file:/nonexistent-folder/secret-name.db',
    }
    const run = promisify(execFile)('npx', ['payload', 'run', 'e2e/previewCopyExport.ts'], { env })
    const failure = await run.then(
      () => ({ code: 0, out: '' }),
      (error: { code: number; stdout: string; stderr: string }) => ({
        code: error.code,
        out: error.stdout + error.stderr,
      }),
    )
    expect(failure.code).toBe(1)
    expect(failure.out.trim()).toBe(
      'preview copy: the export failed (details are not shown: the log is public)',
    )
  }, 180_000)
})
