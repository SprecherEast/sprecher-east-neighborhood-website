import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { gateItem } from '../lib/gate.mjs'
import { rejectUnread } from '../lib/pageRead.mjs'
import { curation } from './fixtures.mjs'
import { contract } from './helpers.mjs'
import { item } from './safetyHelpers.mjs'

// A report whose page the runner could not read can't be dropped (#993): a reject of an item from
// an always-held source is held for a person unless the runner's own read of the item's page
// succeeded. Whether a page was read is a fact the code knows, never what verify wrote, so
// flags, tiers and cited evidence change nothing.

const ID = 'madison-police-incident-reports'
const PAGE = 'https://www.cityofmadison.com/police/incident-reports/2026-11-21/shots-fired'
const cited = [
  { url: PAGE, says: 'Officers are investigating.', retrievedAt: '2026-11-25T12:00:00-06:00' },
]
const PAGE_READ = { url: PAGE, text: 'Armed carjacking. Officers responded.' }
const reject = ({
  read,
  verification = {},
  sourceId = ID,
  decision = 'reject',
  candidate = {},
} = {}) => {
  const built = item({
    candidate: { sourceId, sourceUrl: PAGE, kind: 'news', ...candidate },
    verification: { coverage: 'unknown', flags: [], evidence: [], ...verification },
    curation: curation({ decision, safety: true }),
  })
  if (read !== undefined) built.reportPage = read
  return built
}

describe('a reject from an always-held source', () => {
  it('is held for a person when the runner has not read the report page, whatever verify wrote', () => {
    for (const verification of [
      // The evidence cites the page, for the feed's text only
      { coverage: 'unknown', flags: ['missing-location'], evidence: cited },
      // A tier guessed from the feed text, with no flag and no evidence
      { coverage: 'outside', flags: [], evidence: [] },
      // A place that is unknown with the flag left out
      { coverage: 'unknown', flags: [], evidence: [] },
      { coverage: 'core', flags: [], evidence: cited },
    ]) {
      for (const read of [undefined, null, { url: PAGE, text: '' }]) {
        const gated = gateItem(contract, reject({ read, verification }))
        assert.equal(gated.curation.decision, 'needs-review', JSON.stringify(verification))
        assert.equal(gated.route, 'reportItem')
        assert.equal(gated.suggest, false)
        assert.match(gated.curation.reasons[0], /^Held for review, not accepted: .*page/)
      }
    }
  })

  it('stands when the runner read the page, so a real reject is not held', () => {
    const gated = gateItem(
      contract,
      reject({ read: PAGE_READ, verification: { coverage: 'outside' } }),
    )
    assert.equal(gated.curation.decision, 'reject')
    assert.equal(gated.route, 'none')
  })

  it('counts only a read whose text went to verify', () => {
    for (const read of [true, 1, 'yes', {}, { url: PAGE }, { text: ' ' }, { text: 4 }])
      assert.equal(
        gateItem(contract, reject({ read })).curation.decision,
        'needs-review',
        String(read),
      )
  })

  it('is held when the item is only also reported by an always-held source', () => {
    const built = reject({
      sourceId: 'mpl-pinney-events',
      candidate: { alsoReportedBy: [{ sourceId: ID, sourceUrl: PAGE, externalId: `${ID}:x` }] },
    })
    assert.equal(gateItem(contract, built).curation.decision, 'needs-review')
  })

  it('is not held for a source that is not always held, or for any other decision', () => {
    assert.equal(
      gateItem(contract, reject({ sourceId: 'mpl-pinney-events' })).curation.decision,
      'reject',
    )
    for (const decision of ['update', 'duplicate', 'cancel', 'needs-review'])
      assert.equal(gateItem(contract, reject({ decision })).curation.decision, decision, decision)
  })

  it('stands for a read item even when a source it was also reported by is not listed', () => {
    const built = reject({ read: PAGE_READ, candidate: { alsoReportedBy: [null] } })
    assert.equal(rejectUnread(contract.safety, built), false)
  })

  it('is held when the item or the definition can not be read', () => {
    assert.equal(rejectUnread(contract.safety, {}), true)
    assert.equal(rejectUnread(contract.safety, null), true)
    assert.equal(rejectUnread({}, reject({ sourceId: 'mpl-pinney-events' })), true)
    assert.equal(rejectUnread(undefined, reject({ read: PAGE_READ })), true)
    assert.equal(rejectUnread(contract.safety, reject({ read: PAGE_READ })), false)
  })
})
