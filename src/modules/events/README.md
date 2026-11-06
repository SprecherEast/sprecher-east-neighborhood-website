# Events

The neighborhood calendar: the `events` collection, its listings and pages, and the "this week" block
for CMS pages. Fields, access and hooks: [events content type](../../../docs/reference/content-types/events.md).

## Screens

| Screen       | Route                                                                            | Data comes from                                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All events   | `/events`                                                                        | `events`, upcoming and past, first page of each (`src/app/(frontend)/events/(index)/page.tsx`)                                                                       |
| Category     | `/events/category/[category]`                                                    | `events` in one `categories` doc (`.../(index)/category/[category]/page.tsx`)                                                                                        |
| Filter row   | above both                                                                       | `categories` that have published events, with counts (`use-cases/findEventFilterMenu.ts`); title and intro are hardcoded in `(index)/layout.tsx`                     |
| Paged lists  | `/events/list/[scope]/[page]`, `/events/category/[category]/list/[scope]/[page]` | `events`; the no-JavaScript "Load more" target (`ui/EventListPage.tsx`)                                                                                              |
| Event        | `/events/[slug]`                                                                 | `events` by slug, draft in draft mode (`use-cases/getEventBySlug.ts`); the "Cancelled" text and the "Stay in the Loop" box are hardcoded in `events/[slug]/page.tsx` |
| This week    | block on any CMS page                                                            | the `eventsThisWeek` block's rows, then `events` (`use-cases/findEventsThisWeek.ts`); joined in `src/app/(frontend)/[slug]/pageBlocks.tsx`                           |
| Sidebar list | event and post pages                                                             | next 3 upcoming events (`use-cases/findUpcomingEvents.ts`); joined in `posts/[slug]/page.tsx`                                                                        |

## Behaviors and events

- Upcoming means dated today or later in the site timezone, past means before today; dates are day-only (`data/scope.ts`).
- Upcoming lists run soonest first, 12 a page; past lists newest first, 9 a page (`domain/scope.ts`, `data/queries.ts`).
- "Load more" asks for what follows the last item by cursor, not by page number (`data/queries.ts`, decision 0014); its action only accepts a known scope, a valid cursor and an existing category slug (`actions.ts`).
- Only published events show. Cancelled ones stay listed, counted and openable, marked cancelled; their page drops the register button (`data/listing.ts`, `events/[slug]/page.tsx`).
- An event with `officialBody` is an official meeting: labelled wherever it shows, with the body's `https://` agenda link on its page, and the body as organizer in structured data (`domain/officialMeetings.ts`, `ui/OfficialAgenda.tsx`, `ui/eventJsonLd.ts`).
- Category filters are pages, not query strings; the proxy sends `/events?category=x` to the page and 404s malformed slugs (`src/proxy.ts`, decision 0015).
- The "this week" strip: a row is `all`, `official` or one category; window of 1 to 31 days (default 7) from today; at most 4 rows, 1 to 6 events each; empty rows are hidden, and with none left it shows a message (`domain/thisWeek.ts`, `data/thisWeek.ts`).
- Saving a published event, unpublishing one that was published, or deleting one refreshes its page, `/events`, every category and list page, `/` and all CMS pages, and expires the `events` and `events-sitemap` cache tags (`cms/revalidateEvent.ts`); saving a draft refreshes nothing.
- Events can be scheduled to publish or unpublish (`schedulePublish` in `src/platform/payload/contentCollection.ts`), run by Payload's jobs queue inside the app (`autoRun` in `src/payload.config.ts`); event pages re-render every 10 minutes (`revalidate = 600`), so visitors see the change within 10 minutes (decision 0011).
- Events created by agents or non-staff are stored as `suggested` drafts and need a source; staff publishing approves them (`cms/events.ts` via `holdSuggestions`).
- Events are indexed for search, though this module doesn't name it (`src/payload.config.ts`, `searchPlugin`).
- Admin has Live Preview and a preview link from the draft (`cms/events.ts` via `previewAdmin`); the event page emits schema.org `Event` data (`ui/eventJsonLd.ts`).
- The map link is the editor's `mapsUrl`, else a Google Maps search of the address (`domain/maps.ts`).

## Shared pieces it uses

- Collection helpers from `src/platform/payload/`: `contentCollection`, `draftContentAccess`, `reviewQueue`, `seoTab`, `keyset`, `published` (`cms/events.ts`, `data/queries.ts`).
- UI kit and layout from `src/platform/ui/` (`Card`, `Badge`, `LoadMore.client`, `PageHeader`, `ArticlePage`, `CardGrid`) and the site timezone from `src/platform/lib/timezone.ts`.
- Where it meets other modules (decision 0008): pages in `src/app/`, `pageBlocks.tsx` for the block, `src/payload.config.ts` for the collection, block and search.

## Rules and the tests that protect them

- Upcoming ends at midnight in Madison, not UTC: `data/scope.test.ts`.
- Cursor paging skips and repeats nothing when events change: `data/queries.keyset.test.ts`.
- Cancelled events stay in listings, counts, "Load more" and the sidebar: `use-cases/cancelledEvents.test.ts`.
- The "this week" window and rows: `domain/thisWeek.test.ts`, `use-cases/findEventsThisWeek.test.ts`, `data/mappers.thisWeek.test.ts`.
- Agenda links must be `https://`: `domain/officialMeetings.test.ts`.
- Category filters, counts and "Load more" keep the filter: `data/queries.filter.test.ts`, `domain/filters.test.ts`, `actions.test.ts`.
- Revalidation names only routes that exist: `cms/revalidateEvent.test.ts`.
- Suggestions are held: `src/payload.config.reviewQueue.test.ts`.
- Malformed event URLs are refused by the proxy: `src/proxy.test.ts`.

## Boundaries

- Entry files: `index.ts` (types and pure rules, safe for the proxy and clients), `server.ts` (server-only use cases and components), `cms.ts` (collection and block, never server-only).
- Layers: `domain/` (rules), `use-cases/` (called by pages), `data/` (Payload queries and mappers), `cms/`, `ui/`. It imports no other module; lint enforces the layer and module rules (`eslint.boundaries.config.mjs`).

## Decisions

[0008](../../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md), [0011](../../../docs/architecture/decisions/0011-scheduled-publishing-runner.md), [0013](../../../docs/architecture/decisions/0013-cms-content-through-mappers.md), [0014](../../../docs/architecture/decisions/0014-cursor-paging-for-load-more.md), [0015](../../../docs/architecture/decisions/0015-event-filters-as-pages.md).

## Known gaps

- `featured` is unused: its description promises prominence on the home page, but no page, query or mapper reads it. Only `cms/events.ts` and the seed set it; the generated types and migrations also mention it.
- The filter row counts read every published event's category ids; fine for a small calendar (`data/categories.ts`).
