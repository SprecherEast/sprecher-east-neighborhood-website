# 0015: Each event category filter is a cached page of its own

- **Date:** 2026-10-27
- **Status:** Accepted
- **Issues and PRs:** #122 (item 2)

## Context

/events gets category filters (#122): they come from the CMS, are addressable by URL, work
without JavaScript, keep the no-JavaScript "Load more" pages, and announce the result count.
/events is `force-static` with `revalidate = 600`. A filter in the query string
(`/events?category=civic`) would mean reading `searchParams`, which Next 16 treats as a
request-time API: the page would render on every request (or, kept `force-static`, would never
see the filter). Cache Components, which would keep a static shell, aren't turned on in this app.

## Decision

- **A filter is a path:** `/events/category/<slug>`, with its no-JavaScript pages at
  `/events/category/<slug>/list/<scope>/<n>`. Like the event and list pages, they are built on
  first visit and cached (`generateStaticParams` returns nothing, since the release is built
  without content), and they refresh with /events when an event changes. /events stays static.
- **The query form still works:** the proxy sends `/events?category=<slug>` to the category's
  page. The proxy runs on /events only when that query is there (a `has` condition in its
  matcher). Next's `redirects` would keep the query string on the new URL, so the proxy does it.
- **The filters are the categories with published events**, read from the CMS with their counts
  (`findEventFilterMenu`), sorted by title. A slug from a URL or a "Load more" request must have a
  slug's shape (`isCategorySlug`: `[a-z0-9_-]`, at most 64 characters), checked first. A page's slug
  must then be one of those categories. Only the category's id reaches a query.
- **"Load more" keeps the filter:** `loadMoreEvents(scope, cursor, category)` takes the slug, or
  `null` for every event, and refuses anything else. It looks the slug up with one indexed read
  (`findEventCategoryId`), not the whole filter row, since the action is public and each click is a
  request of its own.
- **The filter row sits in a layout** that /events and the category pages share
  (`events/(index)/layout.tsx`). Moving between filters keeps it mounted, so the pressed link keeps
  keyboard focus and its status line, a polite live region, announces the new count.
- **Malformed URLs never render:** the proxy answers 404 for a slug without a slug's shape and
  for any other path under `/events/category/`, as it does for junk paging URLs (#119).

## Consequences

- Every filtered view is as fast as /events, and each works with JavaScript off.
- A well-formed slug of no category renders the not-found page once and caches it, as an unknown
  event slug does. The number of such pages isn't bounded by the proxy.
- Renaming a category shows on the filter row within 10 minutes (the pages' `revalidate`): a
  category change doesn't refresh event pages, since categories belong to `news`.
- The filter row reads every published event's categories on each render of the events pages.
  That's small today; a count per category in the database is the fix if it grows.
- Filters match the categories set on an event. A parent category doesn't include its
  subcategories' events yet.

## Links

- Code: `src/modules/events/domain/filters.ts`, `src/modules/events/data/categories.ts`,
  `src/modules/events/data/listing.ts`, `src/modules/events/ui/EventFilters.client.tsx`,
  `src/proxy.ts`, `src/app/(frontend)/events/`
- Tests: `src/modules/events/data/queries.filter.test.ts` (in-memory SQLite), `filters.test.ts`,
  `listing.test.ts`, `EventFilters.client.test.tsx`, the action's and the proxy's tests
- Next 16 docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
  (`searchParams` opts a page into dynamic rendering)
