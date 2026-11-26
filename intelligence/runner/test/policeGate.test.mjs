import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { gateItem } from '../lib/gate.mjs'
import { rejectWithoutPage } from '../lib/safety.mjs'
import { curation } from './fixtures.mjs'
import { contract } from './helpers.mjs'
import { item } from './safetyHelpers.mjs'

// A report whose page was never read can't be dropped (#993): a reject of a safety-source item with
// `missing-location` is held for a person unless verify cites the item's own page in its evidence.
// Whether a page was read is a fact, so it is checked in code, never by wording.

const ID = 'madison-police-incident-reports'
const PAGE = 'https://www.cityofmadison.com/police/incident-reports/2026-11-21/shots-fired'
const cited = [
  { url: PAGE, says: 'Officers are investigating.', retrievedAt: '2026-11-25T12:00:00Z' },
]
const reject = ({
  evidence = [],
  flags = ['missing-location'],
  sourceId = ID,
  decision = 'reject',
} = {}) =>
  item({
    candidate: { sourceId, sourceUrl: PAGE, kind: 'news' },
    verification: { coverage: 'unknown', flags, evidence },
    curation: curation({ decision, safety: true }),
  })

describe('a reject of a report with no place', () => {
  it('is held for a person when the report page is not in the evidence', () => {
    for (const evidence of [
      [],
      [
        {
          url: 'https://www.cityofmadison.com/police/incident-reports',
          says: 'x',
          retrievedAt: '2026-11-25T12:00:00Z',
        },
      ],
    ]) {
      const gated = gateItem(contract, reject({ evidence }))
      assert.equal(gated.curation.decision, 'needs-review')
      assert.equal(gated.route, 'reportItem')
      assert.equal(gated.suggest, false)
      assert.match(gated.curation.reasons[0], /^Held for review, not accepted: .*page/)
    }
  })

  it('stays a reject when the report page is cited as read', () => {
    const gated = gateItem(contract, reject({ evidence: cited }))
    assert.equal(gated.curation.decision, 'reject')
    assert.equal(gated.route, 'none')
  })

  it('is only held with missing-location, and only for a safety source', () => {
    assert.equal(gateItem(contract, reject({ flags: [] })).curation.decision, 'reject')
    assert.equal(
      gateItem(contract, reject({ sourceId: 'mpl-pinney-events' })).curation.decision,
      'reject',
    )
    for (const decision of ['update', 'duplicate', 'cancel', 'needs-review'])
      assert.equal(gateItem(contract, reject({ decision })).curation.decision, decision, decision)
  })

  it('is held when the evidence is not a list or an entry has no url', () => {
    for (const evidence of [null, 'read', [null], [{ says: 'x' }], [{ url: 5 }]])
      assert.equal(
        gateItem(contract, reject({ evidence })).curation.decision,
        'needs-review',
        String(evidence),
      )
  })

  it('is held when the evidence cites only a longer address than the report page', () => {
    const longer = [{ ...cited[0], url: `${PAGE}/other` }]
    assert.equal(gateItem(contract, reject({ evidence: longer })).curation.decision, 'needs-review')
  })

  it('counts anything it cannot read as unread', () => {
    assert.equal(rejectWithoutPage(contract.safety, {}), true)
    assert.equal(rejectWithoutPage(contract.safety, null), true)
  })
})
