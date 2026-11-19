# 0005: "Load more" is a real link, with offset paging for now

- **Date:** 2026-10-19
- **Status:** Accepted; the offset paging of "Load more" is superseded by
  [0014](0014-cursor-paging-for-load-more.md)
- **Issues and PRs:** #110, #111, #125

## Context

Events and news lists load more items as you scroll. They must also work without JavaScript, for
search engines and for screen-reader and keyboard users.

## Decision

- "Load more" is a link to a real page (`/events/list/<scope>/<page>`, `/posts/page/<n>`). With
  JavaScript, the same server query loads the next page in place.
- Paging uses page numbers (offset) for now. Page numbers from URLs are validated
  (`parsePageNumber`).
- Edits refresh the cached list pages right away (collection hooks call `revalidatePath`).

## Consequences

- Works everywhere, with one query for both paths.
- If an item a visitor already sees is removed, the next page can skip one item until reload.
  Cursor paging fixes that and is tracked in #125.

## Links

- Code: `src/platform/lib/paging.ts`, `src/platform/ui/LoadMore.client.tsx`, `src/modules/events/data/queries.ts`,
  `src/modules/news/data/queries.ts` (posts)
