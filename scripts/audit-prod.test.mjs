import { describe, expect, it } from 'vitest'

import { AUDIT_ARGS, forbiddenFilesIn } from './audit-prod.mjs'

describe('audit-prod', () => {
  it('keeps the level high, production only, with notes and an expiry required', () => {
    expect(AUDIT_ARGS).toEqual(expect.arrayContaining(['--level', 'high', '--production']))
    expect(AUDIT_ARGS).toEqual(expect.arrayContaining(['--require-notes', '--require-expiry']))
  })

  it('fails when a JavaScript exceptions file exists', () => {
    expect(forbiddenFilesIn('/repo', (p) => p.endsWith('.nsprc.js'))).toEqual(['.nsprc.js'])
    expect(forbiddenFilesIn('/repo', (p) => p.endsWith('.nsprc.cjs'))).toEqual(['.nsprc.cjs'])
  })

  it('passes when only .nsprc exists', () => {
    expect(forbiddenFilesIn('/repo', (p) => p.endsWith('/.nsprc'))).toEqual([])
  })
})
