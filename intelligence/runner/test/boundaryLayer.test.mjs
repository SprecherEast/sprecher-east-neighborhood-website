import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { boundaryFromLayer, refreshBoundary, serializeBoundary } from '../lib/boundary.mjs'
import { box, dataWith, loose, record, ringOf } from './boundaryHelpers.mjs'

// Building the copy from the layer's answer, keeping it, and refreshing it (#1009). Plain fixtures.

describe('building the copy from the layer’s answer', () => {
  const now = new Date('2026-12-01T12:00:00Z')
  const feature = (over = {}) => ({
    type: 'Feature',
    properties: { NA_ID: 5, NEIGHB_NAME: 'Square' },
    geometry: { type: 'Polygon', coordinates: [box(0, 0, 0.1, 0.1)] },
    ...over,
  })
  const answer = (...features) => JSON.stringify({ features })
  const failure = (text, rec = record) => {
    try {
      boundaryFromLayer(text, rec, now)
    } catch (error) {
      return error.message
    }
    return null
  }
  const one = 'expected one feature with NA_ID 5 named Square, got '

  it('says what is wrong with an answer that is not the layer’s', () => {
    assert.equal(failure('<html>'), 'the layer’s answer is not JSON')
    assert.equal(failure('null'), `${one}0`)
    assert.equal(failure('{}'), `${one}0`)
    assert.equal(failure('{"features":0}'), `${one}0`)
    assert.equal(failure(answer(feature(), feature())), `${one}2`)
    assert.equal(
      failure(
        answer(
          null,
          {},
          { properties: { NA_ID: 5 } },
          feature({ properties: { NA_ID: 5, NEIGHB_NAME: 'Other' } }),
        ),
      ),
      `${one}0`,
    )
    assert.equal(failure(answer(null, {}, { properties: { NA_ID: 5 } }, feature())), null)
  })

  it('says what is wrong with the feature it found, joined by semicolons', () => {
    const prefix = 'the layer’s feature can’t be used: '
    assert.equal(
      failure(answer(feature({ geometry: undefined }))),
      `${prefix}geometry must be a Polygon`,
    )
    assert.equal(
      failure(answer(feature({ geometry: { type: 'Polygon', coordinates: null } }))),
      `${prefix}a Polygon needs a ring`,
    )
    assert.equal(
      failure(answer(feature({ geometry: { type: 'Polygon', coordinates: ['abcde'] } }))),
      `${prefix}a ring needs at least 4 points`,
    )
    assert.equal(
      failure(
        answer(
          feature({
            geometry: { type: 'Polygon', coordinates: [[[0, 0], 'ab', [0.1, 0.1], [0, 0]]] },
          }),
        ),
      ),
      `${prefix}every point must be a pair of numbers`,
    )
    assert.equal(
      failure(
        answer(
          feature({
            geometry: { type: 'Polygon', coordinates: [ringOf([0, 0], [0.7, 0.7], [1.4, 1.4])] },
          }),
        ),
      ),
      `${prefix}a ring has no area; the polygon is larger than a neighborhood; a point is outside the area’s bounds in area.yaml (longitude and latitude swapped?)`,
    )
    assert.equal(
      failure(
        answer(
          feature({
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [0.1, 0],
                  [0.1, 0.1],
                  [0.05, 0],
                ],
              ],
            },
          }),
        ),
      ),
      `${prefix}a ring must be closed`,
    )
  })

  it('rounds each coordinate to seven decimals and dates the copy by the day', () => {
    const real = feature({
      geometry: {
        type: 'Polygon',
        coordinates: [
          ringOf(
            [-89.254140370164, 43.095074776666],
            [-89.2441403, 43.095074776666],
            [-89.2441403, 43.105074776666],
          ),
        ],
      },
    })
    const data = boundaryFromLayer(answer(real), loose, now)
    assert.deepEqual(data.geometry.coordinates[0][0], [-89.2541404, 43.0950748])
    assert.equal(data.fetchedAt, '2026-12-01')
    assert.equal(data.geometry.type, 'Polygon')
  })
})

describe('the copy as the file keeps it', () => {
  it('puts each point on one line, whatever its signs', () => {
    const text = serializeBoundary(
      dataWith([
        [0.5, -0.25],
        [-1, 2],
        [0.75, 0.5],
        [0.5, -0.25],
      ]),
    )
    assert.ok(text.includes('[0.5, -0.25]'))
    assert.ok(text.includes('[-1, 2]'))
    assert.ok(text.includes('[0.75, 0.5]'))
    assert.ok(text.endsWith('}\n'))
  })
})

describe('refreshing from the layer', () => {
  const dir = () => mkdtempSync(path.join(tmpdir(), 'refresh-'))
  const reply =
    (status, body = '', headers = {}) =>
    async () =>
      new Response(status >= 300 && status < 400 ? null : body, { status, headers })
  const refused = async (http) => {
    try {
      await refreshBoundary({ dir: dir(), record: loose, http })
    } catch (error) {
      return error.message
    }
    return null
  }
  const layer = (pad = 0) =>
    JSON.stringify({
      features: [
        {
          properties: { NA_ID: 5, NEIGHB_NAME: 'Square' },
          geometry: { type: 'Polygon', coordinates: [box(0, 0, 0.1, 0.1)] },
        },
      ],
    }).padEnd(JSON.stringify({ features: [] }).length + 0 + pad, ' ')

  it('says how the layer failed to answer', async () => {
    const lead = "the City's layer did not answer: "
    assert.equal(await refused(reply(404)), `${lead}404`)
    assert.equal(await refused(reply(500)), `${lead}500 after one retry`)
    assert.equal(await refused(reply(304)), `${lead}not-modified`)
    assert.equal(
      await refused(async () => {
        throw new Error('reset')
      }),
      `${lead}no answer: reset`,
    )
  })

  it('takes an answer of exactly one MiB, and not one byte more', async () => {
    const body = (size) => layer().padEnd(size, ' ')
    const mib = 1024 * 1024
    assert.equal(await refused(reply(200, body(mib))), null)
    assert.equal(
      await refused(reply(200, body(mib + 1))),
      `the City's layer did not answer: body over ${mib} bytes`,
    )
  })

  it('uses the global fetch when no stand-in is given', async (t) => {
    const asked = []
    t.mock.method(
      globalThis,
      'fetch',
      async (url) => (asked.push(String(url)), new Response(layer())),
    )
    const data = await refreshBoundary({ dir: dir(), record: loose })
    assert.equal(data.naId, 5)
    assert.equal(asked.length, 1)
  })
})
