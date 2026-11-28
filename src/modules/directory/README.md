---
name: 'Directory'
type: module
summary: 'FAQ, resources, groups, portraits.'
aliases: ['FAQ', 'resources']
relationships: []
---

# Directory

The FAQ page and the neighborhood resources page, and the collections behind them (`faq`, `resources`),
plus a `team-members` collection no page reads yet. Fields, access and hooks:
[faq](../../../docs/reference/content-types/faq.md) (build it with `npm run docs:generate`),
[resources](../../../docs/reference/content-types/resources.md),
[team-members](../../../docs/reference/content-types/team-members.md); routes:
[screens](../../../docs/reference/routes.md).

## Screens

| Screen    | Route                | Data comes from                                                                                  |
| --------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| FAQ       | `/faq`               | `faq` (`findFaqEntries`); title and intro are hardcoded in `src/app/(frontend)/faq/page.tsx`     |
| Resources | `/resources/<group>` | `resources` (`findResources`); title and intro are hardcoded in `.../resources/[group]/page.tsx` |

## How the pieces link

- A collection's category options are the lists the pages head their sections with, so stored values and headings can't drift: `FAQ_CATEGORIES` and `RESOURCE_CATEGORIES` (`domain/categories.ts`, used by `cms/faq.ts`, `cms/resources.ts`, `domain/sections.ts`).
- `order` sorts each list, lower first, default 99; both the collection's default sort and the queries use it (`cms/orderField.ts`, `data/queries.ts`).
- `photo` shows only when `category` is `elected-officials`, the photo is loaded as an image and `photoCredit` is set. The card draws it with the resource's own credit and source, never the media item's (`domain/resourcePortrait.ts`, `cms/resources.ts`).
- FAQ answers load their linked pages and posts at depth 1 so links keep their address; a document the reader may not see stays an id and shows as plain text (`data/queries.ts`). A page or post save refreshes pages, but never `/faq` ([site pages](../site/README.md), [news](../news/README.md)), so a renamed target shows there when `/faq` next re-renders, within 10 minutes.
- The queries return the stored shape, with no mapper (`domain/types.ts`, architecture rule 8). `server.ts` exports them straight from `data/` (decision 0016).

## Behaviors and events

- Both pages list every published entry (up to 200), grouped by category in the list's order, keeping `order` within each group; categories with no entries are left out. An entry with no category, or one no longer on the list, goes under General (FAQ) or Other (resources) (`domain/sections.ts`, `data/queries.ts`).
- Resources sit in five groups, each its own page at `/resources/<group>` (utilities, government, safety and health, housing and renting, community and family). `RESOURCE_GROUPS` holds the categories of each (every one in exactly one; Other and unlisted ones are in Community and family); a group with no resources still has its page, with a short "being added" message. A group with several categories names each under its heading. Each page ends with related links to the other groups, an unknown address is not found, and `/resources` redirects for good to the first group; the sitemap lists each group page (`src/app/sitemap.ts`, `domain/groups.ts`, `src/app/(frontend)/resources/[group]/page.tsx`, `redirects.js`, #1245).
- Any save or delete of an entry refreshes that collection's page (every group page for resources) and its cache tag, drafts included; the pages show only published entries (`cms/revalidateListPage.ts`). The pages are static and re-render every 10 minutes anyway (`revalidate = 600` in each `page.tsx`).
- Team members: stored with `order`, `status` and `photo`, but no page or query reads them (see Known gaps). Their email is readable by staff only, so the public API omits it (`cms/teamMembers.ts`, #140).
- `publishedAt` is filled in on save when the request leaves it empty (`populatePublishedAt` in `cms/faq.ts`, `cms/resources.ts`).

## Shared pieces it uses

- Collection helpers from `src/platform/payload/`: `draftContentAccess`, `populatePublishedAt`, `imagesOnly`, `published`, `expireCacheTag`, `roles` (`cms/`, `data/queries.ts`).
- UI kit from [`src/platform/ui/`](../../platform/ui/README.md) (`Card`, `Disclosure`, `Media`, `ImageCredit`, `Link`, `Text`) and `RichText` from [`src/platform/richtext/`](../../platform/richtext/README.md) (FAQ answers and the `FAQPage` text).
- Where it meets other modules (decision 0008): the pages in `src/app/(frontend)/faq` and `resources`, and `src/payload.config.ts` for the collections.

## Rules and the tests that protect them

- **Sections follow the category lists.** Entries group in the list's order, keep `order` within a group, and an entry with no category or an unlisted one goes under General (FAQ) or Other (resources); the option lists and the headings are one definition so they cannot drift (`domain/categories.ts`, `domain/sections.ts`; `domain/categories.test.ts`, `domain/sections.test.ts`).
- **Resources sit in five groups,** each its own page; every category is in exactly one group (Other and unlisted ones in Community and family); an empty group still has its page; an unknown group is not found (`domain/groups.ts`).
- **A portrait needs its own credit.** `photoCredit` is required once a photo is set and must leave out "Photo:", which the card adds. It shows only for elected officials, when the photo is an image and `photoCredit` is set; the card draws the resource's credit and source, never the media item's (`domain/resourcePortrait.ts`, `cms/resources.ts`; `domain/resourcePortrait.test.ts`, `data/queries.resources.test.ts`).
- **Links are web addresses.** `url`, up to three extra links (label and URL both required) and the photo source must start with `http://` or `https://`, and the card drops one that fails (`domain/resourceUrl.ts`, `ui/ResourceCard.tsx`; `domain/resourceUrl.test.ts`, `ui/ResourceCard.test.tsx`).
- **A note keeps portraits from reading as an endorsement** under the Elected Officials heading (`RESOURCE_SECTION_NOTES`, #393).
- **FAQ answer links keep their address,** or fall back to plain text when the reader may not see the target (`data/queries.ts`; `data/queries.faq.test.ts`). The page emits schema.org `FAQPage` data (`ui/faqJsonLd.ts`; `ui/faqJsonLd.test.ts`) and its rows open without JavaScript (`ui/FaqList.test.tsx`).
- **`order` is a sidebar number,** 99 by default, lower first (`cms/orderField.ts`; `cms/orderField.test.ts`).

## Boundaries

- Entry files: `index.ts` (types, category lists and section rules, safe for clients), `server.ts` (server-only reads and components), `cms.ts` (the three collections, never server-only).
- Layers: `domain/` (rules), `data/` (Payload queries), `cms/`, `ui/`. There are no use cases: the reads have no logic of their own. It imports no other module; lint enforces it (`eslint.boundaries.config.mjs`).

## Decisions

[0008](../../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md), [0016](../../../docs/architecture/decisions/0016-one-service-helper-no-pass-through-use-cases.md).

## Known gaps

- No page or query reads `team-members`; the public board page is #755. Only the collection, the seed and access tests use it.
- The queries read at most 200 entries; fine for lists this small (`data/queries.ts`).
