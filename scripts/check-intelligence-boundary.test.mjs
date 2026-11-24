import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { copyIntelligence, runCheck } from './check-intelligence-harness.mjs'

// The check reads the dated copy of the City's boundary (#1009): its schema, its geometry, and
// that it is the feature area.yaml names. These run it on a copy of intelligence/ with one change.

const output = (run) => `${run.stdout}${run.stderr}`
const changed = (file, change) => runCheck(copyIntelligence({ [file]: change }))

describe('the boundary copy in the intelligence check', () => {
  it('passes the real copy', () => {
    expect(runCheck(copyIntelligence()).status).toBe(0)
  })

  it('fails a ring that is not closed', () => {
    const run = changed('boundary.json', (text) => {
      const data = JSON.parse(text)
      data.geometry.coordinates[0].pop()
      return JSON.stringify(data)
    })
    expect(run.status).toBe(1)
    expect(output(run)).toContain('must be closed')
  })

  it('fails the copy of another feature', () => {
    const run = changed('boundary.json', (text) => JSON.stringify({ ...JSON.parse(text), naId: 7 }))
    expect(run.status).toBe(1)
    expect(output(run)).toContain('naId is not 146')
  })

  it('fails a copy that breaks its schema', () => {
    const run = changed('boundary.json', (text) => text.replace('"Polygon"', '"Point"'))
    expect(run.status).toBe(1)
    expect(output(run)).toContain('boundary.json')
  })

  it('fails when the file area.yaml names is missing', () => {
    const dir = copyIntelligence()
    fs.rmSync(path.join(dir, 'boundary.json'))
    const run = runCheck(dir)
    expect(run.status).toBe(1)
    expect(output(run)).toContain('boundary.json: missing')
  })
})
