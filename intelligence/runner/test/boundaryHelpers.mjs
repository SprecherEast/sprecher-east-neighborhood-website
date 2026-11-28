import { square } from './geoFixtures.mjs'

// Fixtures for the boundary rule tests (#1009): a copy of the square, rings and boxes.

export const record = square.record
export const loose = { ...record, bounds: undefined }
export const ringOf = (...points) => [...points, points[0]]
export const dataWith = (ring, over = {}) => ({
  source: record.source,
  naId: record.naId,
  fetchedAt: '2026-11-24',
  geometry: { type: 'Polygon', coordinates: [ring] },
  ...over,
})
export const box = (x, y, w, h) => ringOf([x, y], [x + w, y], [x + w, y + h], [x, y + h])
