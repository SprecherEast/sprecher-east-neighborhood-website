# Site: pages and the page builder

How CMS pages are drawn: the hero, each page-builder block, and what a save refreshes. The header,
footer, forum link and redirects have their own note, [navigation](navigation/README.md). Fields, access and hooks:
[pages content type](../../../docs/reference/content-types/pages.md); the routes `/` and `/[slug]`:
[screens](../../../docs/reference/routes.md); the kit pieces: [sections](../../../docs/reference/components/sections.md).

## Links between fields

- The hero's `type` picks the look: `highImpact`, `mediumImpact` or `lowImpact` become `high`, `medium` or `low`; `none` draws nothing (`data/mappers.ts`, `domain/hero.ts`).
- Only the high hero splits its rich text: the first heading is the title (the page's `h1`), the rest is the description on the photo (`ui/PageHero.tsx`, `src/platform/richtext/splitHeadingFromBody.ts`). Medium and low draw the whole rich text as written.
- A content block's layout comes from its columns' `size` values, not from a field (`toContentLayout` in `data/mappers.ts`): one column, or only `full` ones, is `single`; four columns with none `full` is `stats`; two columns that are not both `half` is `columns`; anything else is `cards`.
- In `cards`, a column holding only headings and no link starts a card group and becomes its title; cards before any title form an untitled group (`data/mappers.ts`, `domain/blocks.ts`).
- The archive block stores `populateBy`, `categories`, `limit` and `selectedDocs`; the mapper copies them into `postQuery` beside its `id` and intro, and the block registry hands `postQuery` to news, which loads the posts (`data/mappers.ts`, `src/app/(frontend)/[slug]/pageBlocks.tsx`, `src/modules/news/use-cases/findArchivePosts.ts`).
- A map block's `embedUrl` is stored as its address alone: a pasted iframe is cut down to its `src`, and only a Google map embed address passes (`cms/mapBlock.ts`, `src/platform/lib/googleMapsEmbed.ts`).
- `publishedAt` is filled with now when the save request has none (`src/platform/payload/populatePublishedAt.ts`); the slug `home` is served at `/`, any other slug at `/<slug>` (`src/platform/payload/documentHref.ts`).
- Blocks from other modules (form, "this week", top issues, the archive's posts) are joined in `src/payload.config.ts` (the collection) and `pageBlocks.tsx` (the drawing), so site imports no module (0008; `cms/pages.ts`, `ui/RenderBlocks.tsx`).

## Behaviors and events

- Saving a published page refreshes its path, `/`, every CMS page and the pages sitemap tag. Unpublishing a published page also refreshes its old path; deleting refreshes the same set. A save with `disableRevalidate` (the seed) refreshes nothing (`cms/revalidatePage.ts`).
- Visitors get the published version; editors in draft mode get the latest draft, with access rules skipped (`data/pages.ts`, `use-cases/getPageBySlug.ts`, `draftContentAccess`). The page is read once per request, so the page and its metadata share one query.
- Before a `home` page exists, `/` draws a starter page with its hero and no blocks (`src/app/(frontend)/[slug]/page.tsx`, `toSiteHero`).
- The high hero's photo crops around the upload's focal point set in Admin (the centre when none is set), through `Media`'s `atFocalPoint` (`ui/PageHero.tsx`, `src/platform/lib/focalPoint.ts`, #1013). Post and event pages are not CMS heroes: they head with the plain `PageHeader` title band and show their picture whole in the article, so the picture band with a crop remains only on CMS pages' heroes (`src/platform/ui/PageHeader.tsx`, `FeaturedImage.tsx`).
- A hero draws nothing when its type is `none`, or when it has no text, image or links; a low hero needs text. A low hero never draws links or an image (`toPageHeroProps`, `domain/hero.ts`).
- Site's own blocks reach `ui/` as plain props, other modules' as stored (0013, `data/mappers.ts`). A block type the mapper or `RenderBlocks` doesn't know draws nothing, and a new type without a case fails `tsc` (`ui/RenderBlocks.tsx`).
- Hero links and call-to-action links: the first is the main action, the others secondary, by position, whatever look the editor picked (`ui/PageHero.tsx` high, `ui/CallToActionBlock.tsx`); the medium hero keeps the editor's look. The call to action is a brand-colored band with white text and white buttons.
- A content block draws nothing without columns. `cards` and `stats` sit on a surface band; the others on the plain page. In `cards`, halves sit two to a row, a full card takes its own row, any other mix sits in thirds, and a two-thirds card spans two of three (`ui/ContentBlock.tsx`). A column's link sits under its text, with a gap, at the start (default) or the end of the column, or beside the text (the button floats right under the column's opening heading, if it has one, and the text wraps around it, then runs full width; it never takes a row or column of its own), as an editor chooses (`linkAlign`, #961, #1058, #1062); its look is default (green), outline or orange, the theme's accent color (`Button` variant `accent`, #1050); a single column has no column gap, so it fits a narrow section item.
- A section (#884) is a 12-column row whose items each have their own width (full to a quarter), text alignment, vertical position and phone order, all fields an editor changes in Admin with no code change; each item holds content, media or map blocks. Blocks stacked in one item are spaced evenly, and the map heading matches the text blocks' heading size (#891). From `lg` up the items sit in the order listed, so reading and tab order match what is seen; below `lg` they stack, and phone order may lift an item first or last. Items too wide to share a row wrap to the next (`cms/sectionBlock.ts`, `ui/SectionBlock.tsx`, `ui/columnSpan.ts`, `data/mappers.ts`).
- The map block stacks the title, a small picture and the description inside whatever width it is given, so a section sets its size and place; inside a section it draws without its own page padding (`placement`); a tap on the picture or its button opens the live map in a dialog, and with no address there is no button. The address is checked again in the mapper and in the component, so a stored bad address never frames another site (`ui/MapBlock.tsx`, `data/mappers.ts`, `src/platform/ui/MapEmbed.client.tsx`, #764).
- A page's optional `backdrop` photo is drawn faded behind its hero and blocks (`use-cases/getPageBySlug.ts`, `src/platform/ui/PageBackdrop.tsx`, #777).
- The page re-renders every 10 minutes, so a scheduled publish shows within 10 minutes (`revalidate = 600` in `[slug]/page.tsx`, 0011); `generateStaticParams` and the sitemap skip unpublished pages (`listPageSlugs` in `data/pages.ts`).

## Shared pieces it uses

- Collection helpers from `src/platform/payload/`: `draftVersions`, `previewAdmin`, `titleField`, `draftContentAccess`, `seoTab`, `imagesOnly`, `link`, `headingsEditor`.
- UI kit and richtext from `src/platform/ui/` (`Section`, `Card`, `CardGrid`, `Button`, `LinkButton`, `Media`, `Text`, `MapEmbed`) and `src/platform/richtext/` (`RichText`).
- Where it meets other modules (0008): `src/payload.config.ts` and `pageBlocks.tsx`.
- Related notes: [navigation](navigation/README.md) (header and footer link to these pages, and a page save doesn't refresh them), [events](../events/README.md) ("this week" block; an event save refreshes every CMS page), [news](../news/README.md) (archive and "top issues" blocks; a post save does too), [contact](../contact/README.md) (form block), [directory](../directory/README.md) (a page save never refreshes `/faq`, and FAQ answers link pages, so a renamed page shows there within 10 minutes), [rich text](../../platform/richtext/README.md) (hero title split, `RichText`), [UI kit](../../platform/ui/README.md).

## Rules and the tests that protect them

- The layout follows the column sizes, titles start groups: `data/mappers.test.ts`, `ui/ContentBlock.test.tsx`.
- Hero props per look, empty heroes draw nothing: `data/mappers.pageHero.test.ts`, `ui/PageHero.test.tsx`.
- Only a Google map embed address is stored or drawn: `cms/mapBlock.test.ts`, `data/mapBlockMapper.test.ts`, `ui/MapBlock.test.tsx`.
- A save or delete refreshes the right routes and tags: `cms/revalidatePage.test.ts`, `cms/pages.test.ts`.
- Blocks draw in order by type, unknown types are skipped: `ui/RenderBlocks.test.tsx`.
- Call-to-action buttons and archive anchor: `ui/CallToActionBlock.test.tsx`, `ui/ArchiveBlock.test.tsx`.
- The backdrop is an image or none: `use-cases/getPageBySlug.test.ts`.

## Boundaries

- Entry files: `index.ts` (types and pure rules), `server.ts` (use cases and components pages render), `cms.ts` (collection and blocks, never server-only).
- Layers: `domain/`, `use-cases/`, `data/`, `cms/`, `ui/`; no other module is imported (`eslint.boundaries.config.mjs`).

## Decisions

[0008](../../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md), [0011](../../../docs/architecture/decisions/0011-scheduled-publishing-runner.md), [0013](../../../docs/architecture/decisions/0013-cms-content-through-mappers.md).

## Known gaps

- The archive's `limit` defaults to 10 in the editor, but news uses 3 when it is empty or zero (`findArchivePosts.ts`).
- Changing the slug of a published page doesn't name the old path; it is covered only by the refresh of every CMS page (`cms/revalidatePage.ts`).
- `domain/hero.ts` says the title is the first heading for every look; only the high hero splits it.
