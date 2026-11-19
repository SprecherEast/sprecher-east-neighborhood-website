# Intelligence sources

The approved sources for the neighborhood intelligence agents (#255), checked on **2026-10-24**
for #271, and extended by a hand sweep on **2026-11-10** (#1001). The machine-readable registry is [`sources.yaml`](sources.yaml): one entry per source,
with its feed URL, format, owner, scope, audiences, access limits, cadence, result and an example
item. This page explains the results and what to fix. Change both only through a pull request.

## How each source was checked

Each candidate's feed or page was fetched and read on 2026-10-24: content type, whether it parses,
the newest item and its date, IDs for deduplication, and whether items are about the area. Feed
URLs come from the source's own pages or from search results, never guessed. A URL listed in older
docs counts only if it answered as a feed that day.

- **valid**: answered with a working feed or API and current items.
- **invalid**: the listed URL isn't a feed, or failed.
- **restricted**: reachable only by paying, signing in, or ignoring the site's robots rules.
- **pending**: a useful source with no feed found yet; not collected.

Only `valid` sources are ever fetched automatically.

## Results

| Source                          | Format   | Result     | Pilot |
| ------------------------------- | -------- | ---------- | ----- |
| City meetings (Legistar API)    | JSON API | valid      | 1     |
| Pinney Library events           | iCal     | valid      | 2     |
| City legislation (Legistar API) | JSON API | valid      | 3     |
| Madison365                      | RSS      | valid      | 4     |
| Spectrum News 1 Madison         | RSS      | valid      | later |
| Madison Parks events            | HTML     | pending    | no    |
| District 16 alder blog          | HTML     | valid      | 7     |
| City of Madison news            | HTML     | valid      | 8     |
| City public information mtgs    | HTML     | valid      | 6     |
| WisDOT I-39/90/94 meetings      | HTML     | valid      | 5     |
| Dane County press releases      | HTML     | restricted | no    |
| madison.com                     | RSS      | restricted | no    |
| The Capital Times               | RSS      | invalid    | no    |
| Channel 3000                    | HTML     | invalid    | no    |
| Madison Police incident reports | RSS      | pending    | no    |
| Traffic Engineering news        | HTML     | pending    | no    |
| Road Closures open-data layer   | JSON API | pending    | no    |
| 511 Wisconsin events API        | JSON API | pending    | no    |
| Door Creek Park page            | HTML     | pending    | no    |
| Greater Madison MPO events      | HTML     | pending    | no    |
| Dane County Farmers' Market     | HTML     | pending    | no    |
| Cottage Grove Chamber events    | HTML     | pending    | no    |
| Henry Vilas Zoo lights          | HTML     | pending    | no    |
| Visit Madison holiday guide     | HTML     | pending    | no    |
| Other alders' weekly roundups   | HTML     | pending    | no    |
| MMSD boundary review            | HTML     | pending    | no    |
| Metro Transit public hearings   | HTML     | pending    | no    |
| Metro Transit developer feeds   | HTML     | pending    | no    |
| National Weather Service API    | JSON API | pending    | no    |
| City streets holiday collection | HTML     | pending    | no    |
| United Way volunteer listings   | HTML     | pending    | no    |
| Goodman Community Center        | HTML     | pending    | no    |

Older lists ([content-marketing guideline](../docs/guidelines/content-marketing.md)) named
madison.com, Capital Times, Channel 3000, Dane County and the City planning page as RSS feeds. On
2026-10-24 none of them was a feed an agent may read: madison.com redirects automated readers to
a paid bot gateway (`tollbit.madison.com`), the Capital Times feed failed, the Channel 3000 URL is
a page, and the county and city pages have no feed link.

## The daily pilot

Four sources, all free, public and needing no key:

1. **City meetings, Legistar** (official civic). Structured JSON with stable IDs
   (`EventId`), modification times and an agenda status that shows cancellations. Example: on
   2026-10-24 the 2026-11-03 Board of Health meeting showed as Cancelled, "Rescheduled to
   10/28/2026", with the new meeting listed separately. Always query a date window: unfiltered
   results include placeholder meetings dated up to 2050.
2. **Pinney Library events** (local activities). The library publishes iCalendar feeds for
   subscription, per branch and per age group, with UIDs and modification times. Pinney is the
   branch nearest the area. The feed also holds past items and system-wide closures, so keep only
   future events. The all-events file was too long for the check tool to read to its current
   items; Pinney's Book Discussion feed, from the same generator, was read whole and lists events
   to 2026-12-15 (for example Silent Book Club, 2026-11-17, UID `f893db74…`). The collector's
   first run (#272) confirms a future event in the all-events feed.
3. **City legislation, Legistar** (official civic). Items changed since the last run. Keep only
   those that name a place in the area ([coverage](coverage.md)); match the text on our side,
   because the API's text filter returned a server error.
4. **Madison365** (local media). Standard RSS with a guid on every item. Low share of local
   items: none of the 10 items on 2026-10-24 named the area, so it tests the relevance filter.

Spectrum News 1 is valid but mostly statewide, and its dates aren't in standard RSS format; it
waits for after the pilot.

## Corrections the agents must respect

**Alder district: 16, not 17.** The content-marketing guideline said District 17 in two rows
until #339 corrected it. The City says District 16 (Alder Sean O'Brien) covers "from South Stoughton Road to the
city's edge, and from Reston Heights to Owl Creek", while District 17 (Alder Sabrina V. Madison)
is the northeast corner with Sandburg, East Towne Mall and Reindahl Park
([City of Madison, 2025-08-19](https://www.cityofmadison.com/news/2025-08-19/from-council-to-community-meet-your-eastside-and-northside-alders);
[alder district maps, Feb 2026](https://www.cityofmadison.com/council/council-members/alder-district-maps);
[District 16](https://www.cityofmadison.com/council/district16)). The rest of the repo already
says District 16.

**Schools differed between documents.** The guideline listed Kennedy Elementary, O'Keefe Middle
and East High until #339 replaced the list with the MMSD lookup. MMSD assigns schools by address and
offers a lookup, [Find Your School](https://webapp1.madison.k12.wi.us/webapp1/find_your_school/)
([attendance areas](https://www.madison.k12.wi.us/about/why-mmsd/attendance-area-highlights));
it spells the middle school "O'Keeffe". No primary source in the repo shows one set of schools for
every home, so agents never state which school serves "the neighborhood": they link the lookup
instead. Also #339.

**The boundary.** The City lists Sprecher East among its neighborhood organizations, with its
area on the City's map
([organizations](https://www.cityofmadison.com/dpced/planning/neighborhoods/organizations),
NA_ID 146). The site describes it as I-94 to the north, Door Creek Park to the east, Sprecher Road
to the west and Cottage Grove Road to the south. That matches the eastern half of the City's
[Sprecher Neighborhood Development Plan](https://www.cityofmadison.com/dpced/planning/documents/Sprecher%20NDP_2012.pdf)
area (I-90 to Door Creek valley, I-94 to Cottage Grove Road, bisected by Sprecher Road), which is
partly in the Town of Blooming Grove. [coverage.md](coverage.md) holds the working definition.

## The 2026-11-10 sweep (#1001)

A hand sweep found the sources above marked `pending`. Each entry in `sources.yaml` records what
was seen that day and the issue that finishes its hand check (#993 to #998). None is polled, and
no parser exists yet: those belong to the same issues. Madison Parks events (already listed) got
its new observation, and City Legistar (already `valid`) got a note: contract awards and
resolutions are where a physical project's paper trail turns up.

**Not checked.** The sweep read the pages, not their robots.txt files, so these entries carry no
`robots` check, and a source that needs one (`direct-then-playwright`) can't get it until a hand
check records it. Whether 511 Wisconsin needs a free key isn't confirmed, nor is the live address
of the Road Closures layer (only a catalog entry was found).

**Discovery only.** The Visit Madison guide is a secondary roundup: use it to find events, then
confirm each with its organizer ([coverage](coverage.md), "Review passes").

**Not readable by automation.** The public library's event search page disallows automated
reading (keep the iCalendar source above). United Way's volunteer listings refused an automated
read, so their terms need a hand check (#998). Nextdoor and Facebook need a login, so resident
reports from them reach the Scout only through the owner.

## Out of scope

Nextdoor, Facebook groups and pages, X and other social or login-gated sources are not collected
automatically, and nobody's personal login is used to read them. They stay out until access is
approved in its own issue. The same goes for paid gateways (madison.com) and pages whose
robots rules disallow automated reading (Dane County's subscription page).

## Next

- **#272**, the daily read-only collector for the pilot sources, is blocked by this issue and by
  #141 (Payload jobs). It reads `sources.yaml`, keeps a cursor per source, and dedupes on each
  source's ID (`EventId`, UID, guid) plus a content hash.
- The prompts, coverage policy, schemas and eval set that use this registry are described in
  [README.md](README.md) (#337).
- **Page parsing approved (#352):** Parks events and the District 16 blog are
  `direct-then-playwright`: public City pages, read logged out once a day, on paths robots.txt
  allows (checked 2026-10-24). A direct GET that day served both lists in the HTML, with item
  links (Parks: Bat Fest, 2026-10-24; blog: newest post 2026-10-06), so no browser was needed.
  Parks stays `pending`.
- **HTML parsers (#390, 2026-10-27):** the District 16 blog, City news, the City's public
  information meetings and WisDOT's I-39/90/94 meetings page have no feed, so each has a parser
  for its own list markup (`runner/lib/html.mjs`, with trimmed copies of each page in
  `runner/test/pages/`). All four are `valid` and polled once a day; robots.txt allows each path
  (checked 2026-10-27). City news is citywide, so only releases that name the area go on to a
  model.
- **Notes from the 2026-10-24 checks** (kept here, out of `sources.yaml`'s line budget): none of
  the first 8 Parks events (October 24 to 29) was at Door Creek Park or Elvehjem Sanctuary;
  Pinney's Book Discussion feed held 8 events, 5 of them from 2026-10-15 to 2026-12-15; Spectrum's
  feed uses custom elements, such as `<section>` and `<ticker>`, outside the RSS 2.0 namespace.
- Re-check every source at least once a month, and whenever one fails twice in a row.
