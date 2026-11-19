# 0014: "Load more" asks for what comes after the last item

- **Date:** 2026-10-27
- **Status:** Accepted; supersedes the offset paging of 0005 for "Load more"
- **Issues and PRs:** #125 (from #111)

## Context

[0005](0005-paging-with-real-links.md) paged the `/events` (upcoming and past) and `/posts` lists
by page number: "Load more" asked for page n + 1, an offset of n × the page size. When an item
the visitor already had on screen was removed between two loads (unpublished, deleted, moved to a
later date, or an upcoming event turning past at midnight), every later item moved up one place,
and the next load missed one still-published item until a reload.

Payload's `find` pages by number only; it has no cursor option. Keyset paging is the standard
fix: ask for the items strictly after the last one shown, in an order where no two items tie.

## Decision

- **The order is total.** Each list sorts by its date and then by `id` the same way: events
  `date, id` (upcoming) or `-date, -id` (past), posts `-publishedAt, -id`. Every page uses it,
  numbered pages included (`keysetSort` in `src/platform/payload/keyset.ts`).
- **The cursor is the last item's date and id**, written `<ISO date>|<id>` (an empty date for an
  item without one). Each page returns the cursor after its last item, or `null` when nothing
  follows (`cursorAfterLast` in `src/platform/lib/cursor.ts`). The client sends it back as an
  opaque string.
- **The server action validates it strictly** before any query (`parseCursor`): a string of at
  most 64 characters, exactly two fields, a UTC timestamp exactly as `toISOString()` writes it
  (so February 30 fails), and a positive integer id without leading zeros. Anything else gets the
  action's `Invalid request` error. The query is built from the parsed values only.
- **The next page is the items after the cursor**: `date > d`, or `date = d` and `id > i`, the
  reverse for a descending list (`afterCursor`), within the same published-and-in-scope filter,
  with `overrideAccess: false`, the same `select`, `depth` and page size. SQLite sorts an empty
  date first ascending and last descending; the filter follows that, so a post without
  `publishedAt` is still listed once.
- **The answer** is the items, the next cursor and the list's current total (a `count`), so the
  status line stays right after a change.
- **Without JavaScript nothing changes**: "Load more" is still a link to the next numbered page,
  `/events/list/<scope>/<n>` or `/posts/page/<n>`, and those pages stay numbered.

## Consequences

- Removing, re-dating or publishing an item between loads skips nothing else. An item moved to
  a later place can come again; the client already drops ids it shows.
- An item published before the cursor (dated earlier than the last item shown) isn't loaded into
  the open list; a reload shows it. That's the expected trade-off of keyset paging.
- The numbered no-JavaScript pages still page by offset, and can skip an item the same way if
  content changes between two page visits. They are separate page views, so this is accepted.
- Each "Load more" runs two queries (the page and the count). Neither `events.date` nor
  `posts.publishedAt` has a database index yet, so both scan their table. The tables are small,
  so that is cheap today; an index on the sort date is the fix if they grow.

## Links

- Code: `src/platform/lib/cursor.ts`, `src/platform/payload/keyset.ts`,
  `src/platform/ui/LoadMore.client.tsx`, `src/modules/events/data/queries.ts`,
  `src/modules/news/data/queries.ts`, and each module's `actions.ts`
- Tests: `src/modules/events/data/queries.keyset.test.ts` and
  `src/modules/news/data/queries.keyset.test.ts` (in-memory SQLite), `cursor.test.ts`,
  `keyset.test.ts`, the actions' tests
- [Use the index, Luke: paging through results](https://use-the-index-luke.com/no-offset)
