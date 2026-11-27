---
name: 'Site pages'
type: module
summary: 'CMS pages: hero, blocks, refresh on save.'
aliases: ['pages', 'page builder', 'hero']
relationships: []
---

# Site: pages and the page builder

How CMS pages are drawn: the hero, each page-builder block, and what a save refreshes. In the CMS: the `pages` collection (drafts, scheduled publish, a `backdrop` photo and an optional hero) and its blocks; the `header`, `footer` and redirects have their own note, [navigation](navigation/README.md). Not in the CMS: the block drawing, the hero geometry and the choice of which module's block fills a slot. Fields, access and hooks: [pages content type](../../../docs/reference/content-types/pages.md); the routes `/` and `/[slug]`: [screens](../../../docs/reference/routes.md); the kit pieces: [sections](../../../docs/reference/components/sections.md).

## Screens

| Screen        | Route          | Data comes from                                                                        |
| ------------- | -------------- | -------------------------------------------------------------------------------------- |
| Home and page | `/`, `/[slug]` | `getPageBySlug` (`home` is served at `/`); before a `home` page exists, a starter hero |

## How the pieces link

- **Blocks:** the pages collection holds the site's own blocks (content, call to action, section, map, archive) and takes other modules' (form from [contact](../contact/README.md), "this week" from [events](../events/README.md), "top issues" and the archive's posts from [news](../news/README.md)) from `src/payload.config.ts`; `src/app/(frontend)/[slug]/pageBlocks.tsx` draws those, so site imports no module (0008; `cms/pages.ts`, `ui/RenderBlocks.tsx`).
- **Mappers:** the site's own blocks reach `ui/` as plain props, other modules' as stored (0013, `data/mappers.ts`). A block type the mapper or `RenderBlocks` does not know draws nothing, and a new type without a case fails `tsc`.
- **The archive block** stores `populateBy`, `categories`, `limit` and `selectedDocs`; the mapper passes them as `postQuery` and news loads the posts (`src/modules/news/use-cases/findArchivePosts.ts`).
- **Libraries doing real work:** Payload's own pages collection with its SEO and redirects plugins (see the [shared Payload note](../../platform/payload/README.md)); the rich text is [Lexical](../../platform/richtext/README.md).
- **Other notes:** [directory](../directory/README.md) (a page save never refreshes `/faq`, so a renamed page shows there within 10 minutes), [UI kit](../../platform/ui/README.md).

## Behaviors and events

- **A save refreshes** a published page's path, `/`, every CMS page and the pages sitemap tag; unpublishing or deleting refreshes the same set; a save with `disableRevalidate` (the seed) refreshes nothing (`cms/revalidatePage.ts`). Events and news saves refresh every CMS page too.
- **Visitors get the published version;** editors in draft mode get the latest draft with access rules skipped; the page is read once per request so the page and its metadata share a query (`data/pages.ts`, `use-cases/getPageBySlug.ts`).
- **The page re-renders every 10 minutes** (`revalidate = 600`, 0011), so a scheduled publish shows within 10 minutes; `generateStaticParams` and the sitemap skip unpublished pages (`listPageSlugs` in `data/pages.ts`).
- **`publishedAt` is filled with now** when the save has none (`src/platform/payload/populatePublishedAt.ts`).
- **A page's `backdrop` photo** is drawn faded behind its hero and blocks (`use-cases/getPageBySlug.ts`, `src/platform/ui/PageBackdrop.tsx`, #777).
- **Map blocks** draw a picture made by `scripts/map-preview/`; a tap on the picture, or on the expand icon over its top-right corner (#1426), opens the live map in a dialog (`ui/MapBlock.tsx`, `src/platform/ui/MapEmbed.client.tsx`, #764, #1419).

## Shared pieces it uses

- Collection helpers from `src/platform/payload/`: `draftVersions`, `previewAdmin`, `titleField`, `draftContentAccess`, `seoTab`, `imagesOnly`, `link`, `headingsEditor`.
- Kit and rich text: `Section`, `Card`, `CardGrid`, `Button`, `LinkButton`, `Media`, `Text`, `MapEmbed`, `GlassPanel`, `PageBackdrop`, `RichText`, `splitHeadingFromBody`.
- Where it meets other modules (0008): `src/payload.config.ts` and `pageBlocks.tsx`.

## Rules and the tests that protect them

- **The hero's look comes from its type:** `highImpact`, `mediumImpact` and `lowImpact` become high, medium and low; `none` draws nothing. A hero draws nothing without text, image or links; a low hero needs text and never draws links or an image. Only the high hero splits its rich text (first heading is the page's `h1`, the rest the description on a `GlassPanel`); its photo crops around the upload's focal point and its title and description are placed from the horizon that point marks, which is the middle when no point is set (`data/mappers.ts`, `domain/hero.ts`, `domain/heroGeometry.ts`, `ui/PageHero.tsx`; `data/mappers.pageHero.test.ts`, `ui/PageHero.test.tsx`, `domain/heroGeometry.test.ts`).
- **Hero and call-to-action links are ranked by position:** the first is the main action, the rest secondary, whatever look the editor picked; the medium hero keeps the editor's look (`ui/CallToActionBlock.tsx`; `ui/CallToActionBlock.test.tsx`).
- **A content block's layout comes from its columns' sizes,** not a field: one column, or only `full` ones, is single; four columns with none `full`, stats; two that are not both `half`, columns; anything else, cards. In cards a heading-only column without a link starts a card group and becomes its title (`toContentLayout` in `data/mappers.ts`, `domain/blocks.ts`; `data/mappers.test.ts`, `ui/ContentBlock.test.tsx`).
- **In a `cards` block, halves sit two to a row, a full card takes its own row and any other mix sits in thirds;** `cards` and `stats` sit on a surface band, the other layouts on the plain page (`ui/ContentBlock.tsx`; `ui/ContentBlock.test.tsx`).
- **A column's link button sits at the start, at the end or beside the text** (`linkAlign`: `start`, `end`, `beside`; beside floats it right under the opening heading with the text wrapping around it, and on a phone it falls under the text) (`cms/contentBlock.ts`, `ui/ContentBlock.tsx`, #961; `cms/contentBlock.test.ts`).
- **A share bar draws only when its four percents are all set and add up to 100** (`shareBar` in `data/mappers.ts`, `ui/ContentBlock.tsx`, #1266).
- **A section is a 12-column row** whose items have their own width, alignment, vertical position and phone order, all set in Admin; reading and tab order follow the listed order from `lg` up (`cms/sectionBlock.ts`, `ui/SectionBlock.tsx`, `ui/columnSpan.ts`, #884).
- **Only a Google map embed address is stored or drawn:** a pasted iframe is cut to its `src`, and the address is checked again when mapped and drawn (`cms/mapBlock.ts`, `src/platform/lib/googleMapsEmbed.ts`; `cms/mapBlock.test.ts`, `data/mapBlockMapper.test.ts`, `ui/MapBlock.test.tsx`).
- **A save or delete refreshes the right routes and tags** (`cms/revalidatePage.test.ts`, `cms/pages.test.ts`); blocks draw in order and unknown types are skipped (`ui/RenderBlocks.test.tsx`); the backdrop is an image or none (`use-cases/getPageBySlug.test.ts`).

## Boundaries

- Entry files: `index.ts` (types and pure rules), `server.ts` (use cases and components pages render), `cms.ts` (collection and blocks, never server-only). Layers: `domain/`, `use-cases/`, `data/`, `cms/`, `ui/`; no other module is imported (`eslint.boundaries.config.mjs`).

## Decisions

[0008](../../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md), [0011](../../../docs/architecture/decisions/0011-scheduled-publishing-runner.md), [0013](../../../docs/architecture/decisions/0013-cms-content-through-mappers.md).

## Known gaps

- The archive's `limit` defaults to 10 in the editor, but news uses 3 when it is empty or zero (`findArchivePosts.ts`).
- Changing the slug of a published page does not name the old path; only the refresh of every CMS page covers it (`cms/revalidatePage.ts`).
- `domain/hero.ts` says the title is the first heading for every look; only the high hero splits it.
