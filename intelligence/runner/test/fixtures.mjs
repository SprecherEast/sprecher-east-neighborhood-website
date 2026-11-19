import { fakeAdapter } from '../lib/model.mjs'

// Stage answers that validate against their schemas, for a fake model, and the four pilot
// sources' feeds as the sites publish them (synthetic content, real shapes).

export const verification = (overrides = {}) => ({
  location: {
    name: 'Pinney Library',
    address: '516 Cottage Grove Rd',
    municipality: 'Madison',
    verified: true,
  },
  coverage: 'catchment',
  coverageReason: 'Pinney Library is the branch nearest the area.',
  confidence: 0.9,
  dateConfirmed: true,
  statusConfirmed: 'scheduled',
  evidence: [
    {
      url: 'https://www.madisonpubliclibrary.org/events/1',
      says: 'Nov 17, 7 PM',
      retrievedAt: '2026-10-25T12:00:00Z',
    },
  ],
  unknowns: [],
  flags: [],
  ...overrides,
})

export const curation = (overrides = {}) => ({
  decision: 'accept',
  reasons: ['Free, nearby, for everyone.'],
  scores: { evidence: 3, freshness: 3, relevance: 2, timeliness: 3, actionability: 3 },
  audiences: ['everyone'],
  whyItMatters: 'A free evening close to home.',
  residentAction: 'Drop in; no registration.',
  targetCollection: null,
  targetId: null,
  ...overrides,
})

export const draft = (overrides = {}) => ({
  collection: 'events',
  title: 'Silent Book Club at Pinney Library',
  bodyMarkdown: 'Bring a book and read with neighbors. Free; no registration.',
  summary: 'A quiet hour of reading with neighbors at Pinney Library. Free.',
  categories: ['community'],
  startsAt: '2026-11-17T19:00:00-06:00',
  endsAt: null,
  allDay: false,
  venue: 'Pinney Library',
  address: '516 Cottage Grove Rd',
  audience: ['everyone'],
  officialLinks: ['https://www.madisonpubliclibrary.org/events/1'],
  imageCandidates: [],
  confidence: 'high',
  missing: [],
  ...overrides,
})

export const candidate = (overrides = {}) => ({
  sourceId: 'mpl-pinney-events',
  sourceName: 'Madison Public Library, Pinney Library events (iCalendar)',
  sourceUrl: 'https://www.madisonpubliclibrary.org/events/1',
  externalId: 'mpl-pinney-events:f893db74',
  contentHash: 'e'.repeat(64),
  retrievedAt: '2026-10-25T12:00:00Z',
  kind: 'event',
  title: 'Silent Book Club',
  sourceText: 'Bring a book.',
  startsAt: '2026-11-17T19:00:00-06:00',
  endsAt: null,
  allDay: false,
  locationText: 'Pinney Library',
  sourceStatus: 'scheduled',
  change: 'new',
  ...overrides,
})

export const FEEDS = {
  'legistar-events': JSON.stringify([
    {
      EventId: 29400,
      EventBodyName: 'COMMON COUNCIL',
      EventDate: '2026-11-03T00:00:00',
      EventTime: '6:30 PM',
      EventLocation: 'Virtual',
    },
    {
      EventId: 29401,
      EventBodyName: 'TRANSPORTATION COMMISSION',
      EventDate: '2026-11-04T00:00:00',
      EventTime: '5:00 PM',
      EventLocation: 'Virtual',
    },
  ]),
  'mpl-pinney-events': [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:f893db74',
    'DTSTART;TZID=America/Chicago:20261117T190000',
    'SUMMARY:Silent Book Club',
    'DESCRIPTION:Bring a book. https://www.madisonpubliclibrary.org/events/1',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n'),
  'legistar-matters': JSON.stringify([
    {
      MatterId: 103200,
      MatterFile: '95400',
      MatterTitle: 'Sidewalk and lighting on Sprecher Road',
      MatterTypeName: 'Resolution',
      MatterLastModifiedUtc: '2026-10-24T15:00:00.12',
    },
    {
      MatterId: 103201,
      MatterFile: '95401',
      MatterTitle: 'Citywide fee schedule',
      MatterLastModifiedUtc: '2026-10-24T16:00:00',
    },
  ]),
  'madison365-news':
    '<rss><channel><item><guid>m365-9</guid><title>Free coat drive at east side libraries</title><link>https://madison365.com/coats/</link><description>Coats for families.</description></item></channel></rss>',
  // The HTML pages (#390), each with no items today: their parsers have their own tests
  'district16-blog': '<main><ul class="list--unstyled cards"></ul></main>',
  'city-news': '<main><ul class="list--unstyled"></ul></main>',
  'city-public-info-meetings': '<main><ul class="list--items list--unstyled"></ul></main>',
  'wisdot-i39-90-94': '<h1>News and Meetings</h1>',
}

/** The City of Madison page each HTML source reads, by path. */
const cityPages = {
  '/council/district16/blog': 'district16-blog',
  '/news': 'city-news',
  '/events/public-information-meetings': 'city-public-info-meetings',
}

/** A `fetch` double serving FEEDS by source, robots.txt allowing everything. */
export function feedsHttp(feeds = FEEDS, { etag = '"v1"' } = {}) {
  const hosts = {
    'webapi.legistar.com': (url) =>
      url.includes('/matters') ? feeds['legistar-matters'] : feeds['legistar-events'],
    'www.madisonpubliclibrary.org': () => feeds['mpl-pinney-events'],
    'madison365.com': () => feeds['madison365-news'],
    'www.cityofmadison.com': (url) => feeds[cityPages[new URL(url).pathname]],
    'www.i399094project.wisconsindot.gov': () => feeds['wisdot-i39-90-94'],
  }
  const requested = []
  const http = async (url, init = {}) => {
    requested.push({ url, init })
    const { hostname, pathname } = new URL(url)
    if (pathname === '/robots.txt') return new Response('User-agent: *\nDisallow:\n')
    if (init.headers?.['if-none-match'] === etag) return new Response(null, { status: 304 })
    const body = hosts[hostname]?.(url)
    if (body === undefined) return new Response('not found', { status: 404 })
    return new Response(body, { status: 200, headers: { etag } })
  }
  return Object.assign(http, { requested })
}

/** A model that accepts the library event and the Sprecher Road item, with an image candidate. */
export const accepting = fakeAdapter(({ stageId, item }) => {
  if (stageId === 'verify') return verification()
  if (stageId === 'curate')
    return /Silent Book Club|Sprecher Road/.test(item.candidate.title)
      ? curation()
      : curation({ decision: 'reject' })
  return item.candidate.kind === 'legislation'
    ? draft({
        collection: 'posts',
        title: 'Sidewalks for Sprecher Road',
        startsAt: null,
        endsAt: null,
        allDay: null,
        venue: null,
        address: null,
      })
    : draft({
        imageCandidates: [
          {
            imageUrl: 'https://www.madisonpubliclibrary.org/i.jpg',
            pageUrl: 'https://www.madisonpubliclibrary.org/events/1',
            credit: 'MPL',
          },
        ],
      })
})
