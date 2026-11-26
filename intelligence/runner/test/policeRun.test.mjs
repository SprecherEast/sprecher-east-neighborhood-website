import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { robotsChecker } from '../lib/fetchSource.mjs'
import { fakeAdapter } from '../lib/model.mjs'
import { runPipeline } from '../lib/pipeline.mjs'
import { curation, draft, FEEDS, feedsHttp, verification } from './fixtures.mjs'
import { INSIDE, JUST_OUTSIDE } from './geoFixtures.mjs'
import { contractOn } from './helpers.mjs'
import { cmsWithLog } from './safetyHelpers.mjs'

// A dry run over the police incident reports feed (#993): a block inside the area is placed as
// core and one elsewhere as outside by the City's boundary, never by words in a title, and
// neither is ever a suggestion, whatever the model answers.

const BASE = 'https://www.cityofmadison.com/police/incident-reports'
const item = (path, title, description) =>
  `<item><title>${title}</title><link>${BASE}/${path}</link><description><![CDATA[${description}]]></description><guid isPermaLink="false">${BASE}/${path}#2026-10-25T08:00:00</guid></item>`
const feeds = {
  ...FEEDS,
  'madison-police-incident-reports': `<rss><channel>${[
    item(
      'a',
      'Armed carjacking',
      '7000 block Littlemore Dr, Officers responded after a car was taken at gunpoint.',
    ),
    item(
      'b',
      'Shots fired near Sprecher Road',
      '5200 block Cottage Grove Rd, Officers found shell casings after a report of shots fired.',
    ),
  ].join('')}</channel></rss>`,
}
const POINTS = { '7000 Littlemore Dr': INSIDE, '5200 Cottage Grove Rd': JUST_OUTSIDE }

const run = async ({ pages = false, decision = 'accept', denyRobots = false } = {}) => {
  const base = feedsHttp(feeds)
  // The report pages, when the City serves them
  const http = Object.assign(
    async (url, init) =>
      pages && new URL(url).pathname.startsWith('/police/incident-reports/')
        ? (base.requested.push({ url, init }), new Response('<h1>Report</h1>', { status: 200 }))
        : base(url, init),
    { requested: base.requested },
  )
  const cms = cmsWithLog()
  const asked = []
  const result = await runPipeline({
    contract: contractOn('2026-10-25'),
    cms,
    // The model says what a careless one would: both are local, clear, and fit to accept
    ask: fakeAdapter(({ stageId, item: given }) => {
      const police = given.candidate.sourceId === 'madison-police-incident-reports'
      // Verify writes the address the report gives
      if (stageId === 'verify')
        return verification({
          coverage: police ? 'core' : 'outside',
          ...(police && {
            location: {
              name: null,
              address: given.candidate.locationText,
              municipality: 'Madison',
              verified: true,
            },
          }),
        })
      if (stageId === 'curate')
        return police && decision === 'accept'
          ? curation()
          : curation({ decision: 'reject', reasons: ['No.'] })
      return draft()
    }),
    state: { sources: {}, seen: {} },
    http,
    robots: denyRobots ? async (url) => !url.includes('/police/') : robotsChecker(http),
    geocode: async (street) => {
      asked.push(street)
      return POINTS[street] ? { status: 'match', point: POINTS[street] } : { status: 'none' }
    },
    repoCommit: 'a'.repeat(40),
    now: () => new Date('2026-10-25T17:00:00Z'),
  })
  return { ...result, cms, asked, requested: http.requested.map((r) => r.url) }
}

describe('a dry run over the police incident reports', () => {
  it('places each block by the boundary and holds both for a person, never as a suggestion', async () => {
    const { cms, asked } = await run()
    // The locator hears the first address of each block, never the word "block"
    for (const street of ['5200 Cottage Grove Rd', '7000 Littlemore Dr'])
      assert.ok(asked.includes(street), street)
    assert.ok(asked.every((street) => !/block/i.test(street)))
    assert.deepEqual(cms.submitted, [])
    const reports = cms.writes.filter((w) => w.tool === 'reportItem')
    assert.equal(reports.length, 2)
    const byPage = Object.fromEntries(
      reports.map((r) => [r.arguments.externalId.split('/').at(-1), r.arguments]),
    )
    assert.match(byPage.a.summary, /Placed by the boundary: inside the area/)
    assert.match(byPage.a.summary, /safety item/)
    assert.match(byPage.b.summary, /Placed by the boundary: outside the area/)
    // A word in the outside item's title never made it local, and the boundary's change is flagged
    assert.deepEqual(byPage.b.flags, ['ambiguous-location'])
  })
})

describe('a reject of a police report in a run', () => {
  const pageUrls = (requested) =>
    requested.filter((url) => url.includes('/police/incident-reports/'))

  it('is held for a person when the City did not serve the report page', async () => {
    const { cms, log } = await run({ decision: 'reject' })
    assert.deepEqual(cms.submitted, [])
    const reports = cms.writes.filter((w) => w.tool === 'reportItem')
    assert.equal(reports.length, 2)
    for (const report of reports) {
      assert.equal(report.arguments.kind, 'needs-review')
      assert.match(report.arguments.summary, /did not read the report page/)
    }
    // Only the four items of other sources are rejected
    assert.equal(log.counts.rejected, 4)
  })

  it('stands when the runner read the page, and sends nothing to a person', async () => {
    const { cms, log, requested } = await run({ decision: 'reject', pages: true })
    assert.deepEqual(cms.submitted, [])
    assert.equal(cms.writes.filter((w) => w.tool === 'reportItem').length, 0)
    // The four items of other sources, and the two reports whose pages were read
    assert.equal(log.counts.rejected, 6)
    // One read of each report's own page, and no other page of the City's police site
    assert.deepEqual(pageUrls(requested).sort(), [`${BASE}/a`, `${BASE}/b`])
    // Items of other sources are not read, though a page of theirs would answer
    assert.equal(
      requested.some((url) => url.endsWith('/events/1')),
      false,
    )
  })

  it('is held for a person when robots.txt disallows the report page', async () => {
    const { cms, requested } = await run({ decision: 'reject', pages: true, denyRobots: true })
    assert.equal(pageUrls(requested).length, 0)
    assert.equal(cms.writes.filter((w) => w.tool === 'reportItem').length, 2)
  })
})
