import { loadBoundary } from '../lib/boundary.mjs'
import { createPlacer } from '../lib/place.mjs'
import { candidate, verification } from './fixtures.mjs'
import { INSIDE, JUST_INSIDE, JUST_OUTSIDE, PARK_SOUTH_ACCESS } from './geoFixtures.mjs'
import { contract, intelligenceDir } from './helpers.mjs'

// Doubles for the placement tests (#1009): the real boundary copy, a geocoder that answers from a
// table of recorded points, and verify's answer for an address.

export const record = contract.area.boundary
export const boundary = loadBoundary(intelligenceDir, record)
const POINTS = {
  '7035 Littlemore Dr': INSIDE,
  '7202 Cottage Grove Rd': PARK_SOUTH_ACCESS,
  '100 Inside Edge Rd': JUST_INSIDE,
  '200 Outside Edge Rd': JUST_OUTSIDE,
}

/** A geocoder double: answers the point of a known street address, or what `answer` says. */
export const geocoder = (answer) => {
  const asked = []
  const geocode = async (street) => {
    asked.push(street)
    if (answer) return answer(street)
    return POINTS[street] ? { status: 'match', point: POINTS[street] } : { status: 'none' }
  }
  return Object.assign(geocode, { asked })
}
export const setup = ({ geocode = geocoder(), problems = [], ...rest } = {}) => ({
  geocode,
  problems,
  place: createPlacer({
    boundary,
    record,
    geocode,
    onProblem: (text) => problems.push(text),
    ...rest,
  }),
})
export const located = (address, overrides = {}) =>
  verification({
    location: { name: 'Somewhere', address, municipality: 'Madison', verified: true },
    ...overrides,
  })
export const item = (locationText = null) => candidate({ locationText })
