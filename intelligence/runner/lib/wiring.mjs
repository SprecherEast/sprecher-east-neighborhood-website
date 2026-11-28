import { cityGeocoder } from './geocode.mjs'
import { robotsChecker } from './fetchSource.mjs'

// What the command hands the pipeline besides its own state (#1009): the HTTP function, the
// robots.txt check on it, the City's locator with the settings from area.yaml, and the commit.
// A function of its inputs so a test can call it; run.mjs only reads the flags and calls this.
export function runInputs({ contract, http, commit }) {
  return {
    contract,
    http,
    robots: robotsChecker(http),
    geocode: cityGeocoder({ http, config: contract.area.boundary.geocoder }),
    repoCommit: commit,
  }
}
