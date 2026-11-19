import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { IMAGE_REVIEW_MARKER, imagePublishCheck } from './rules.mjs'

const upload = "const fd = new FormData(); await fetch('/api/media', { method: 'POST', body: fd })"
const assign =
  "await fetch('/api/events/16', { method: 'PATCH', body: JSON.stringify({ heroImage: 32 }) })"

describe('imagePublishCheck', () => {
  it('refuses a media upload without the review line', () => {
    expect(imagePublishCheck(upload)).toMatch(/Image review first/)
  })

  it('refuses setting an image on any collection, or through GraphQL', () => {
    expect(imagePublishCheck(assign)).toMatch(/Image review first/)
    const other =
      "fetch('/api/venues/2', { method: 'PATCH', body: JSON.stringify({ meta: { image: 30 } }) })"
    expect(imagePublishCheck(other)).toMatch(/Image review first/)
    const gql =
      "fetch('/api/graphql', { method: 'POST', body: 'mutation { updatePost(data: {heroImage: 3}) }' })"
    expect(imagePublishCheck(gql)).toMatch(/Image review first/)
  })

  it('sees a URL built by concatenation', () => {
    const joined = "fetch('/api/' + 'media', { method: 'POST', body: new FormData() })"
    expect(imagePublishCheck(joined)).toMatch(/Image review first/)
  })

  it('lets a script that carries the review line run', () => {
    expect(imagePublishCheck(`// ${IMAGE_REVIEW_MARKER}\n${upload}`)).toBeNull()
  })

  it('ignores reads and scripts that publish no image', () => {
    expect(imagePublishCheck("fetch('/api/media?limit=5')")).toBeNull()
    expect(imagePublishCheck("fetch('/api/events/16?select[heroImage]=true')")).toBeNull()
    const title = "fetch('/api/events/16', { method: 'PATCH', body: '{\"title\":\"x\"}' })"
    expect(imagePublishCheck(title)).toBeNull()
    expect(imagePublishCheck(undefined)).toBeNull()
  })
})

describe('before-browser-script hook', () => {
  const hook = path.join(path.dirname(fileURLToPath(import.meta.url)), 'before-browser-script.mjs')
  const run = (text) =>
    spawnSync('node', [hook], { input: JSON.stringify({ tool_input: { text } }), encoding: 'utf8' })

  it('exits 2 with the reason when unmarked, 0 when marked', () => {
    const blocked = run(upload)
    expect(blocked.status).toBe(2)
    expect(blocked.stderr).toMatch(/Blocked: Image review first/)
    expect(run(`// ${IMAGE_REVIEW_MARKER}\n${upload}`).status).toBe(0)
  })
})
