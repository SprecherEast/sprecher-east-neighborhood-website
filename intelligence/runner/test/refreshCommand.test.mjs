import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { copyIntelligence } from '../../../scripts/check-intelligence-harness.mjs'
import { boundaryProblems, loadBoundary } from '../lib/boundary.mjs'
import { contract, intelligenceDir } from './helpers.mjs'

// `node run.mjs --refresh-boundary` (#1009), run as the command it is. The child's `fetch` is
// replaced before it starts, so nothing reaches the network: the stand-in answers the City's layer
// with the committed polygon, and the test reads what the command wrote.

const runner = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const record = contract.area.boundary

describe('node run.mjs --refresh-boundary', () => {
  it('rewrites the copy from the layer’s answer, dated today, and says so', () => {
    const copy = copyIntelligence()
    const before = loadBoundary(intelligenceDir, record)
    writeFileSync(
      path.join(copy, record.file),
      JSON.stringify({ ...before, fetchedAt: '2020-01-01' }),
    )
    const feature = {
      type: 'Feature',
      properties: { [record.field]: record.naId, NEIGHB_NAME: `${record.name}  ` },
      geometry: before.geometry,
    }
    const stub = path.join(mkdtempSync(path.join(tmpdir(), 'stub-')), 'fetch.mjs')
    writeFileSync(
      stub,
      `globalThis.fetch = async (url) => {
        if (!String(url).startsWith(${JSON.stringify(record.source)})) throw new Error('unexpected ' + url)
        return new Response(${JSON.stringify(JSON.stringify({ type: 'FeatureCollection', features: [feature] }))}, { status: 200 })
      }\n`,
    )
    const run = spawnSync(
      process.execPath,
      [
        '--import',
        stub,
        path.join(runner, 'run.mjs'),
        '--refresh-boundary',
        '--intelligence',
        copy,
      ],
      { encoding: 'utf8' },
    )
    assert.equal(run.status, 0, run.stderr)
    const written = JSON.parse(readFileSync(path.join(copy, record.file), 'utf8'))
    assert.equal(written.fetchedAt, new Date().toISOString().slice(0, 10))
    assert.deepEqual(boundaryProblems(written, record), [])
    assert.match(
      run.stdout,
      /boundary\.json rewritten from the City's layer, dated \d{4}-\d\d-\d\d/,
    )
  })
})
