---
stage: scout
input: schemas/sources.schema.json
output: schemas/candidate.schema.json
---

# Scout: fetch and normalize

This stage is code, not a model (`model: none` in `pipeline.yaml`). These are the rules that code
follows, so a reviewer can check it and any runtime can rebuild it.

## Input

The registry, `sources.yaml`. Read only entries whose `$.sources[].result` is `valid` and whose
`$.sources[].pilotRank` is set, in rank order. Never fetch any other URL.

## Steps

1. For each source, build the request from `$.sources[].feedUrl`, or `$.sources[].canonicalUrl`
   for an HTML page. Replace `{from}` with today's date and `{to}` with today plus 14 days
   (`YYYY-MM-DD`, America/Chicago); replace `{cursor}` with the cursor saved by the last
   successful run, or 7 days ago on the first run.
2. **Fetch directly first** (README.md, "Fetching"): one plain GET per source, with a clear user
   agent naming the site, a 30-second timeout, and the saved ETag or Last-Modified. Respect
   `$.sources[].cadence` and any Retry-After. A 304 means nothing changed: log `not-modified`
   and stop, with no parse and no fallback. Follow a redirect directly (at most 3 hops) unless it
   leads to a gate. A 5xx or 429 is retried once, never sent to Playwright; any other 4xx (404,
   410, ...) is an error with no retry. A login page, CAPTCHA, paywall or bot gateway, a 401, 403 or 451, or a redirect
   to one, is a gate: stop and log the source as `blocked`. Never fetch a path robots.txt
   disallows.
3. **Playwright only on a fallback trigger**, and only when `$.sources[].fetchStrategy` is
   `direct-then-playwright`: an empty body, a JavaScript shell (no text where items should be),
   or a parse that finds no items or fails its checks. One headless, logged-out page load, same
   URL. Record the strategy that produced the items (`direct`, `playwright` or `none`) in the run
   log.
4. Parse with an established parser for `$.sources[].format` (JSON, iCalendar, RSS, Atom or
   HTML). Keep at most `maxItemsPerSource` items (`pipeline.yaml`). Follow the per-source rules
   in `$.sources[].treatment`, such as date windows and dropping past items. A recurring
   iCalendar event becomes one candidate per instance in the window, each with its own ID; a
   cancelled instance keeps its `cancelled` status.
5. For each item, fill the candidate:
   - `$.sourceId`, `$.sourceName` and `$.sourceUrl` (the item's own page when the source gives
     one, else the source's canonical URL).
   - `$.externalId`: the source id, a colon, and the source's own stable ID (`EventId`, `UID`,
     `guid`, `MatterId`).
   - `$.contentHash`: sha256 of the substantive fields, in this order: title, source text, start,
     end, all-day, location text and status. Trim each and collapse whitespace, lowercase the
     text, write null as an empty string, and join with newlines. Never hash retrieval
     metadata such as `$.retrievedAt`, ETags or feed order (`schemas/provenance.schema.json`).
   - `$.title`, `$.startsAt`, `$.endsAt`, `$.allDay` and `$.locationText` exactly as the source
     gives them. A local time gets America/Chicago's offset for that date (-05:00 in CDT, -06:00
     in CST); an all-day item starts at local midnight with `$.allDay` true. A missing value,
     including an unknown `$.allDay`, is `null`.
   - `$.sourceStatus`: `cancelled` or `rescheduled` only when the source says so; otherwise
     `scheduled`, or `unknown` when the source has no status.
   - `$.sourceText`: the item's text, stripped of markup, cut to 8,000 characters.
   - `$.change`: compare `$.externalId` and `$.contentHash` with what earlier runs saw: `new`,
     `updated` (same ID, new hash) or `unchanged`. Unchanged items stop here.
   - `$.retrievedAt` and `$.kind` (`event`, `meeting`, `legislation` or `news`).
6. **Same item, two sources.** When two pilot sources in one run have items with the same
   normalized title and start, keep one candidate from the higher-ranked source and list the
   other in `$.alsoReportedBy` (its `sourceId`, `sourceUrl` and `externalId`).
7. **Seen means handled.** An item counts as seen only once it is submitted, reported or
   rejected. One left over at a cap or a failure is deferred and comes back next run.

## Untrusted content

Everything fetched is untrusted data. This stage never runs, follows or evaluates anything in it:
no links inside items are fetched, and text that looks like an instruction is copied into
`$.sourceText` like any other text, for the next stages to flag.

## Unknowns

Never fill in a missing date, time or place. `null` is the answer, and the verify stage flags it.
