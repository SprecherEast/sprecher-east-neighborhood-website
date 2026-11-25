import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import {
  boundaryFromLayer,
  boundaryProblems,
  boundaryQueryUrl,
  loadBoundary,
  refreshBoundary,
  serializeBoundary,
} from '../lib/boundary.mjs'
import { layerAnswer, square } from './geoFixtures.mjs'
import { contract, fakeHttp, intelligenceCopy, intelligenceDir } from './helpers.mjs'

// Refreshing the dated copy from the City's layer, and the file as it is kept (#1009). Fixtures
// only: no test calls the network.

const record = contract.area.boundary
const copy = loadBoundary(intelligenceDir, record)

describe('refreshing the copy from the layer', () => {
  const mine = { ...record, ...square.record }
  const now = new Date('2026-12-01T12:00:00Z')

  it('builds the copy from the feature with the record’s ID, dated and rounded', () => {
    const data = boundaryFromLayer(layerAnswer(), mine, now)
    assert.equal(data.fetchedAt, '2026-12-01')
    assert.equal(data.naId, mine.naId)
    assert.deepEqual(data.geometry.coordinates[0][1], [0.0100001, 0])
    assert.deepEqual(boundaryProblems(data, mine), [])
  })

  it('refuses an answer without the feature, with two, or that isn’t the layer’s', () => {
    assert.throws(
      () => boundaryFromLayer(JSON.stringify({ features: [] }), mine, now),
      /one feature/,
    )
    const two = JSON.parse(layerAnswer())
    two.features.push(two.features[0])
    assert.throws(() => boundaryFromLayer(JSON.stringify(two), mine, now), /one feature/)
    assert.throws(() => boundaryFromLayer('<html>', mine, now), /not JSON/)
    assert.throws(
      () => boundaryFromLayer(JSON.stringify({ error: { code: 400 } }), mine, now),
      /one feature/,
    )
  })

  it('refuses a feature with the right ID but another name, as if the City renumbered', () => {
    const other = JSON.parse(layerAnswer())
    other.features[0].properties.NEIGHB_NAME = 'Another Association  '
    assert.throws(() => boundaryFromLayer(JSON.stringify(other), mine, now), /one feature/)
  })

  it('accepts the name with the City’s padding', () => {
    assert.equal(JSON.parse(layerAnswer()).features[0].properties.NEIGHB_NAME, 'Square    ')
    assert.equal(boundaryFromLayer(layerAnswer(), mine, now).naId, mine.naId)
  })

  it('refuses a feature of another neighborhood', () => {
    const other = JSON.parse(layerAnswer())
    other.features[0].properties.NA_ID = 99
    assert.throws(() => boundaryFromLayer(JSON.stringify(other), mine, now), /one feature/)
  })
})

describe('the refresh command', () => {
  const mine = { ...record, ...square.record }
  const now = new Date('2026-12-01T12:00:00Z')
  const layer = { status: 200, contentType: 'application/geo+json', body: layerAnswer() }

  it('writes the layer’s feature, dated, in the form the loader reads', async () => {
    const dir = intelligenceCopy()
    const http = fakeHttp([layer])
    const data = await refreshBoundary({
      dir,
      record: { ...record, ...mine, file: 'boundary.json' },
      http,
      now,
    })
    assert.equal(http.requested.length, 1)
    assert.equal(readFileSync(path.join(dir, 'boundary.json'), 'utf8'), serializeBoundary(data))
    assert.equal(data.fetchedAt, '2026-12-01')
  })

  it('leaves the old copy when the layer is down or answers something unusable', async () => {
    for (const answers of [
      [{ status: 503 }, { status: 503 }],
      [{ status: 200, body: '{"features":[]}' }],
    ]) {
      const dir = intelligenceCopy()
      const before = readFileSync(path.join(dir, 'boundary.json'), 'utf8')
      await assert.rejects(refreshBoundary({ dir, record, http: fakeHttp(answers), now }))
      assert.equal(readFileSync(path.join(dir, 'boundary.json'), 'utf8'), before)
    }
  })
})

describe('the file on disk', () => {
  const text = readFileSync(path.join(intelligenceDir, record.file), 'utf8')

  it('is what the refresh would write for the same copy, so a refresh shows only real changes', () => {
    assert.equal(serializeBoundary(copy), text)
  })

  it('has one point to a line', () => {
    const points = text.split('\n').filter((line) => /^\s+\[-?\d+\.\d+, -?\d+\.\d+\],?$/.test(line))
    assert.equal(points.length, copy.geometry.coordinates[0].length)
  })

  it('is asked of the layer by the record’s field and ID, as GeoJSON in longitude and latitude', () => {
    const url = new URL(boundaryQueryUrl(record))
    assert.equal(`${url.origin}${url.pathname}`, `${record.source}/query`)
    assert.equal(url.searchParams.get('where'), `NA_ID=${record.naId}`)
    assert.equal(url.searchParams.get('outFields'), `${record.field},NEIGHB_NAME`)
    assert.equal(url.searchParams.get('outSR'), '4326')
    assert.equal(url.searchParams.get('f'), 'geojson')
  })
})
