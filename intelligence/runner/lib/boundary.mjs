import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { fetchDirect } from './fetchSource.mjs'

// The City's boundary for the area (#1009): the dated copy kept in the repo (area.yaml
// `boundary`), the check that it can be used, the test of a point against it, and the refresh
// from the City's layer. Plain geometry on longitude and latitude; no network here.

const DAY_MS = 86_400_000
/** A neighborhood is well under half a degree across (about 40 km): anything larger is a mistake. */
const MAX_EXTENT_DEGREES = 0.5
/** About 0.1 mm: a point this close to an edge is on it. */
const ON_EDGE_DEGREES = 1e-9
const isCoordinate = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)

/** Why `ring` can't be used, as short phrases. */
function ringProblems(ring, bounds) {
  if (!Array.isArray(ring) || ring.length < 4) return ['a ring needs at least 4 points']
  if (!ring.every(isCoordinate)) return ['every point must be a pair of numbers']
  if (ring.some(([x, y]) => Math.abs(x) > 180 || Math.abs(y) > 90))
    return ['a point is out of range for longitude and latitude']
  const [first, last] = [ring[0], ring.at(-1)]
  if (first[0] !== last[0] || first[1] !== last[1]) return ['a ring must be closed']
  const xs = ring.map((p) => p[0])
  const ys = ring.map((p) => p[1])
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  const area = ring.slice(1).reduce((sum, p, i) => sum + ring[i][0] * p[1] - p[0] * ring[i][1], 0)
  return [
    ...(area === 0 ? ['a ring has no area'] : []),
    ...(extent > MAX_EXTENT_DEGREES ? ['the polygon is larger than a neighborhood'] : []),
    ...(bounds && !ring.every(([x, y]) => inBounds(bounds, x, y))
      ? ['a point is outside the area’s bounds in area.yaml (longitude and latitude swapped?)']
      : []),
  ]
}

const inBounds = (b, x, y) => x >= b.west && x <= b.east && y >= b.south && y <= b.north

/** Why `data` can't be the boundary of `record` (area.yaml): empty when it can. */
export function boundaryProblems(data, record) {
  const problems = []
  if (data?.naId !== record.naId) problems.push(`naId is not ${record.naId}`)
  if (data?.source !== record.source) problems.push('source is not the record’s layer')
  const { geometry } = data ?? {}
  if (!geometry || typeof geometry !== 'object') return [...problems, 'geometry is missing']
  if (geometry.type !== 'Polygon') return [...problems, 'geometry must be a Polygon']
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0)
    return [...problems, 'a Polygon needs a ring']
  return [...problems, ...geometry.coordinates.flatMap((ring) => ringProblems(ring, record.bounds))]
}

/**
 * The boundary copy that area.yaml names, in `dir`. Throws, naming the file, when it is missing,
 * isn't JSON, fails `validate` (its JSON Schema) or can't be used. A run never starts on a bad one.
 */
export function loadBoundary(dir, record, validate = () => []) {
  let data
  try {
    data = JSON.parse(readFileSync(path.join(dir, record.file), 'utf8'))
  } catch (error) {
    const why = error instanceof SyntaxError ? 'not JSON' : error.message
    throw new Error(`${record.file}: the boundary is ${why}`)
  }
  const shape = validate(data)
  const problems = shape.length > 0 ? shape : boundaryProblems(data, record)
  if (problems.length > 0) throw new Error(`${record.file}: ${problems.slice(0, 3).join('; ')}`)
  return data
}

/** Whether `point` ([longitude, latitude]) is inside the polygon, an edge or a vertex counting as inside. */
export function pointPlace(data, point) {
  if (!isCoordinate(point)) throw new TypeError('a point is a pair of numbers')
  const [x, y] = point
  let crossings = 0
  for (const ring of data.geometry.coordinates) {
    for (let i = 1; i < ring.length; i++) {
      const [ax, ay] = ring[i - 1]
      const [bx, by] = ring[i]
      if (distanceToSegment(x, y, ax, ay, bx, by) <= ON_EDGE_DEGREES) return 'inside'
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) crossings++
    }
  }
  return crossings % 2 === 1 ? 'inside' : 'outside'
}

function distanceToSegment(x, y, ax, ay, bx, by) {
  const [dx, dy] = [bx - ax, by - ay]
  const length = dx * dx + dy * dy
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length))
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
}

/** Whole days between the copy's date and `now`. */
export const boundaryAgeDays = (data, now) =>
  Math.floor((now.getTime() - Date.parse(`${data.fetchedAt}T12:00:00Z`)) / DAY_MS)

/** The run-log line for a copy older than `record.maxAgeDays`, or null. */
export function staleBoundaryProblem(data, record, now) {
  const age = boundaryAgeDays(data, now)
  if (data.fetchedAt > now.toISOString().slice(0, 10))
    return `The copy of the City's boundary is dated in the future (${data.fetchedAt}); fix its date.`
  return age > record.maxAgeDays
    ? `The copy of the City's boundary is ${age} days old (limit ${record.maxAgeDays}); refresh it with node run.mjs --refresh-boundary.`
    : null
}

/** The layer query that answers the record's feature as GeoJSON in longitude and latitude. */
export const boundaryQueryUrl = (record) =>
  `${record.source}/query?where=${record.field}%3D${record.naId}&outFields=${record.field},NEIGHB_NAME&outSR=4326&returnGeometry=true&f=geojson`

const round = (n) => Math.round(n * 1e7) / 1e7

/** The boundary copy built from the layer's answer (`text`), dated `now`. Throws when it can't be used. */
export function boundaryFromLayer(text, record, now) {
  let answer
  try {
    answer = JSON.parse(text)
  } catch {
    throw new Error('the layer’s answer is not JSON')
  }
  // The ID and the name must both match, so a renumbering can't bring in another association
  const features = Array.isArray(answer?.features) ? answer.features : []
  const found = features.filter(
    (f) =>
      f?.properties?.[record.field] === record.naId &&
      String(f.properties.NEIGHB_NAME).trim() === record.name,
  )
  if (found.length !== 1)
    throw new Error(
      `expected one feature with ${record.field} ${record.naId} named ${record.name}, got ${found.length}`,
    )
  const { type, coordinates } = found[0].geometry ?? {}
  const data = {
    source: record.source,
    naId: record.naId,
    fetchedAt: now.toISOString().slice(0, 10),
    geometry: {
      type,
      coordinates: Array.isArray(coordinates)
        ? coordinates.map((ring) =>
            Array.isArray(ring) ? ring.map((p) => (Array.isArray(p) ? p.map(round) : p)) : ring,
          )
        : coordinates,
    },
  }
  const problems = boundaryProblems(data, record)
  if (problems.length > 0)
    throw new Error(`the layer’s feature can’t be used: ${problems.join('; ')}`)
  return data
}

/** The copy as the file holds it: two-space JSON with each point on one line. */
export const serializeBoundary = (data) =>
  `${JSON.stringify(data, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]')}\n`

/**
 * Fetches the record's feature from the City's layer and rewrites the copy in `dir`. The old file
 * stays when the layer can't be reached or its answer can't be used. Answers the new copy.
 */
export async function refreshBoundary({ dir, record, http, now = new Date() }) {
  const answer = await fetchDirect(boundaryQueryUrl(record), { http, maxBytes: 1024 * 1024 })
  if (answer.status !== 'ok')
    throw new Error(`the City's layer did not answer: ${answer.error ?? answer.status}`)
  const data = boundaryFromLayer(answer.body, record, now)
  writeFileSync(path.join(dir, record.file), serializeBoundary(data))
  return data
}
