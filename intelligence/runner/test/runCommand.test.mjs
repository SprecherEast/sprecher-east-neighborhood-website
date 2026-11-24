import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { copyIntelligence } from '../../../scripts/check-intelligence-harness.mjs'

// `node run.mjs --dry-run` (#1009), run as the command it is, with `fetch` replaced before it
// starts: every request is written down and answered 404, so nothing reaches the network. What
// the command hands the pipeline shows in the run log and in the requests (the City's locator
// settings are pinned in wiring.test.mjs, where a test can call them).

const runner = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function dryRun(intelligence) {
  const dir = mkdtempSync(path.join(tmpdir(), 'dry-run-'))
  const stub = path.join(dir, 'fetch.mjs')
  writeFileSync(
    stub,
    `import { appendFileSync } from 'node:fs'
globalThis.fetch = async (url) => {
  appendFileSync(${JSON.stringify(path.join(dir, 'urls.txt'))}, url + '\\n')
  return new Response('', { status: 404 })
}\n`,
  )
  const digest = path.join(dir, 'digest.json')
  const run = spawnSync(
    process.execPath,
    [
      '--import',
      stub,
      path.join(runner, 'run.mjs'),
      '--dry-run',
      '--intelligence',
      intelligence,
      '--state',
      path.join(dir, 'state.json'),
      '--digest',
      digest,
    ],
    { encoding: 'utf8', env: { ...process.env, SPRECHER_EAST_MCP_KEY: '' } },
  )
  assert.equal(run.status, 0, run.stderr)
  return {
    log: JSON.parse(readFileSync(digest, 'utf8')).log,
    urls: readFileSync(path.join(dir, 'urls.txt'), 'utf8').trim().split('\n'),
  }
}

describe('node run.mjs --dry-run', () => {
  it('checks the sources and their robots.txt through the replaced fetch', () => {
    const { log, urls } = dryRun(copyIntelligence())
    assert.ok(log.sourcesChecked.length > 0)
    assert.ok(urls.includes('https://webapi.legistar.com/robots.txt'))
    assert.ok(urls.some((url) => url.startsWith('https://webapi.legistar.com/v1/madison/events?')))
  })

  it('records the commit of the checkout it loads, or zeros when there is none', () => {
    assert.equal(dryRun(copyIntelligence()).log.repoCommit, '0'.repeat(40))
    const copy = copyIntelligence()
    const git = (...args) =>
      execFileSync(
        'git',
        ['-C', copy, '-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args],
        { encoding: 'utf8' },
      ).trim()
    git('init', '-q')
    git('add', '.')
    git('commit', '-q', '-m', 'copy')
    assert.equal(dryRun(copy).log.repoCommit, git('rev-parse', 'HEAD'))
  })
})
