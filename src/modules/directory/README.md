# Directory

The FAQ page and the neighborhood resources page, and the collections behind them (`faq`, `resources`),
plus a `team-members` collection no page reads yet. Fields, access and hooks:
[faq](../../../docs/reference/content-types/faq.md),
[resources](../../../docs/reference/content-types/resources.md),
[team-members](../../../docs/reference/content-types/team-members.md); routes:
[screens](../../../docs/reference/routes.md).

## Links between fields and code

- A collection's category options are the lists the pages head their sections with, so stored values and headings can't drift: `FAQ_CATEGORIES` and `RESOURCE_CATEGORIES` (`domain/categories.ts`, used by `cms/faq.ts`, `cms/resources.ts`, `domain/sections.ts`).
- `order` sorts each list, lower first, default 99; both the collection's default sort and the queries use it (`cms/orderField.ts`, `data/queries.ts`).
- `photo` shows only when `category` is `elected-officials`, the photo is loaded as an image and `photoCredit` is set. The card draws it with the resource's own credit and source, never the media item's (`domain/resourcePortrait.ts`, `cms/resources.ts`).
- `photoCredit` is required once `photo` is set; the check reads its sibling `photo` (`cms/resources.ts`, `domain/resourcePortrait.ts`).
- FAQ answers load their linked pages and posts at depth 1 so links keep their address; a document the reader may not see stays an id and shows as plain text (`data/queries.ts`). A page or post save refreshes pages, but never `/faq` ([site pages](../site/README.md), [news](../news/README.md)), so a renamed target shows there when `/faq` next re-renders, within 10 minutes.
- The queries return the stored shape, with no mapper (`domain/types.ts`, architecture rule 8). `server.ts` exports them straight from `data/` (decision 0016).

## Screens

| Screen    | Route        | Data comes from                                                                              |
| --------- | ------------ | -------------------------------------------------------------------------------------------- |
| FAQ       | `/faq`       | `faq` (`findFaqEntries`); title and intro are hardcoded in `src/app/(frontend)/faq/page.tsx` |
| Resources | `/resources` | `resources` (`findResources`); title and intro are hardcoded in `.../resources/page.tsx`     |

## Behaviors and events

- Both pages list every published entry (up to 200), grouped by category in the list's order, keeping `order` within each group; categories with no entries are left out. An entry with no category, or one no longer on the list, goes under General (FAQ) or Other (resources) (`domain/sections.ts`, `data/queries.ts`).
- Any save or delete of an entry refreshes that collection's one page and its cache tag, drafts included; the page shows only published entries (`cms/revalidateListPage.ts`). Both pages are static and re-render every 10 minutes anyway (`revalidate = 600` in each `page.tsx`).
- Resource links (`url`, each extra link, the photo source) must start with `http://` or `https://`; up to three more links, each with a required label and URL. The card also drops any link that fails the check (`domain/resourceUrl.ts`, `cms/resources.ts`, `ui/ResourceCard.tsx`).
- A note shows under some section headings so photos don't read as an endorsement: today the Elected Officials one (`RESOURCE_SECTION_NOTES`, #393; rendered in `resources/page.tsx`).
- FAQ entries are cards that open without JavaScript (`ui/FaqList.tsx` through the kit's `Disclosure`), and the page emits schema.org `FAQPage` data of every question (`ui/faqJsonLd.ts`).
- Team members: stored with `order`, `status` and `photo`, but no page or query reads them (see Known gaps). Their email is readable by staff only, so the public API omits it (`cms/teamMembers.ts`, #140).
- `publishedAt` is filled in on save when the request leaves it empty (`populatePublishedAt` in `cms/faq.ts`, `cms/resources.ts`).

## Shared pieces it uses

- Collection helpers from `src/platform/payload/`: `draftContentAccess`, `populatePublishedAt`, `imagesOnly`, `published`, `expireCacheTag`, `roles` (`cms/`, `data/queries.ts`).
- UI kit from [`src/platform/ui/`](../../platform/ui/README.md) (`Card`, `Disclosure`, `Media`, `ImageCredit`, `Link`, `Text`) and `RichText` from [`src/platform/richtext/`](../../platform/richtext/README.md) (FAQ answers and the `FAQPage` text).
- Where it meets other modules (decision 0008): the pages in `src/app/(frontend)/faq` and `resources`, and `src/payload.config.ts` for the collections.

## Rules and the tests that protect them

- Category lists keep their order and unique values: `domain/categories.test.ts`.
- Entries group in category order, with unknown or missing categories in General or Other: `domain/sections.test.ts`.
- `order` is a sidebar number, 99 by default, lower first: `cms/orderField.test.ts`.
- A photo needs a credit without "Photo:"; the portrait shows only for elected officials, with the resource's own credit: `domain/resourcePortrait.test.ts`.
- Links must be web addresses: `domain/resourceUrl.test.ts`, `data/queries.resources.test.ts`.
- The portrait must be an image, and a link row needs a URL: `data/queries.resources.test.ts`.
- Answer links keep their address, or fall back to plain text: `data/queries.faq.test.ts`.
- The card and the portrait layout: `ui/ResourceCard.test.tsx`; the open-and-close rows: `ui/FaqList.test.tsx`; the `FAQPage` data: `ui/faqJsonLd.test.ts`.

## Boundaries

- Entry files: `index.ts` (types, category lists and section rules, safe for clients), `server.ts` (server-only reads and components), `cms.ts` (the three collections, never server-only).
- Layers: `domain/` (rules), `data/` (Payload queries), `cms/`, `ui/`. There are no use cases: the reads have no logic of their own. It imports no other module; lint enforces it (`eslint.boundaries.config.mjs`).

## Decisions

[0008](../../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md), [0016](../../../docs/architecture/decisions/0016-one-service-helper-no-pass-through-use-cases.md).

## Known gaps

- No page or query reads `team-members`; the public board page is #755. Only the collection, the seed and access tests use it.
- The queries read at most 200 entries; fine for lists this small (`data/queries.ts`).
