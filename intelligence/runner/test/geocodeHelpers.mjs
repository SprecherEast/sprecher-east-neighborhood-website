import { cityGeocoder } from '../lib/geocode.mjs'
import { contract, fakeHttp } from './helpers.mjs'

// Doubles for the locator tests (#1009): its settings, an answer, and one asked address.

export const config = contract.area.boundary.geocoder
export const json = (body) => ({ status: 200, contentType: 'application/json', body })
export const ask = async (street, ...answers) => {
  const http = fakeHttp(answers)
  const result = await cityGeocoder({ http, config })(street)
  return { result, http }
}
