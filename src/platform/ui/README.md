# UI kit

The shared components every page and module builds with (`src/platform/ui/`): what they do beyond
their props, and which values they share with the CSS. Props, variants and where each is used:
[shared components reference](../../../docs/reference/components/README.md); rules and decided choices:
[component-set.md](../../../docs/ui/component-set.md). A change here reaches every page.

## How the pieces link

- `layoutSizes.ts` and `scrollMargin.ts` hold Tailwind classes that read CSS variables from `src/app/(frontend)/globals.css` (`--reading-width`, `--header-clearance`, `--anchor-offset`, `--chart-small-width`), so each size is defined once (#616); `layoutSizes.test.ts` and `scrollMargin.test.ts` check the names.
- `Button` and `Link` render through `AppLink`: `next/link` for routes, a plain `<a>` for in-page `#` links so keyboard focus moves (`AppLink.tsx`). `LinkButton` (`CMSLink.tsx`) turns a resolved CMS link into a `Button`: appearance `outline` becomes `secondary`, anything else `primary`.
- `Media` picks `VideoMedia` for a `video` mime type, else `ImageMedia` (`Media.tsx`). `getMediaUrl` keeps upload paths relative so Next optimizes them as local images, and the image's `updatedAt` is appended as its cache key (`ImageMedia.client.tsx`, `src/platform/lib/getMediaUrl.ts`).
- A chart's colours follow its parts' order, `chart-1` to `chart-6`, the [theme](../theme/README.md)'s chart tokens; a chart whose spec says `palette: 'warm'` is drawn in orange and gray, by marking its root `data-chart-palette`, so no adapter changes; a seventh part throws (`src/platform/ui/chart/chartPalette.ts`), and the spec refuses it first (`src/platform/lib/chart/spec.ts`). `LegendSlot` and `SWATCH_COLOUR` in `Legend.tsx` are also fixed at six.
- A `Field` hands its one control its id, `aria-describedby` and `aria-invalid` through one context; a control outside a `Field` throws (`fieldContext.ts`, `Field.client.tsx`).

## Behaviors

- A button with `loading` shows a spinner and ignores clicks but stays focusable (`aria-disabled`), so focus isn't lost (`Button.tsx`). `external` opens a new tab and adds spoken text saying so (`Button.tsx`, `Link.tsx`).
- Charts: `Chart` checks the spec, asks `chart/chartRegistry.ts` for an adapter, and draws the key, caption and numbers table around it. The first adapter that supports the kind draws it (`breakdown`: breakdown; `css`: units; `visx`: bar, stacked); the `text` adapter supports every kind and is last. Every adapter passes `chart/chartAdapter.contract.tsx`; chart libraries are allowed only under `chart/adapters/` (lint, `CHART_LIBRARIES` in `eslint.boundaries.config.mjs`).
- A breakdown (#866) is drawn at full width, not as a thumbnail: a grid of squares worth a fixed dollar amount each (rounded to whole squares, largest remainder; `hideSquares` leaves out the grid, its key and the square value, so only the ranked bars show, #943), a key in dollars, ranked bars with the main pieces nested under their area in the area's colour, and the other pieces in one list under "See the smaller pieces", biggest first and coloured by their own rank. Colour follows size, from `chart-ramp-1` to `chart-ramp-7`; pale steps keep a thin outline and every figure is also text. Bar length is share times one shared scale, so a dollar is the same length in every breakdown (`chart/adapters/breakdown/`, `lib/chart/breakdown.ts`; the design reference is `docs/ui/reference/breakdown-chart-preview.html`).
- Every chart carries its numbers as a real table under "Show the numbers", closed by default (`chart/ChartDataTable.tsx`). A drawing that gains from size is a thumbnail; `ChartZoom` is a thin caller of the shared `Zoom`, which moves the same server-rendered chart into a full-screen `Dialog` instead of copying it, and is the chart's only client code (`chart/ChartZoom.client.tsx`, `Zoom.client.tsx`). With scripting off the Enlarge button is hidden.
- `Figure` floats a small picture right from `md` (two fifths of the text column by default; `size` sets a third or half) and fills the column below. Its key, long caption and the larger picture show only in the `Zoom` dialog, never in the small view (`Figure.tsx`, `Zoom.client.tsx`, #816).
- `VersionCheck` (root layout) polls `/api/version` every 30 s, but only while the reader has been active in the last 30 s and the tab is visible, and again when the tab regains focus. The first answer is the baseline; a different build shows a toast with a Refresh button that reloads. A dismissed build isn't offered again; a newer one is. It does nothing when the server reports `development` (`VersionCheck.client.tsx`, `src/app/(frontend)/api/version/route.ts`).
- `AdminBar` is always mounted but hidden until Payload's bar reports a signed-in admin or editor (`isStaffRole`); residents see nothing (`AdminBar.client.tsx`, #203). `LivePreviewListener` refreshes the page when the editor saves in Live Preview; `[slug]/page.tsx` mounts it only in draft mode.
- `LoadMore` (`useLoadMore`, `LoadMoreFooter`) loads the next page by cursor shortly before the end, for 4 pages counting the first (`AUTO_LOAD_PAGES`); after that the reader clicks "Load more", so the footer stays reachable. The button is a real link to the next numbered page, so it works without JavaScript and in a new tab; a repeated item is dropped; if focus was on the button when the last load removed it, focus moves to the status line (`LoadMore.client.tsx`).
- The "On this page" menu needs at least 3 sections (`MIN_SECTIONS` in `onThisPage.ts`); the highlighted section is the last heading above a reading line taken from the heading's own scroll margin plus a little slack, so the heading a click lands on is the highlighted one.
- `MapEmbed` draws a live map only when `toGoogleMapsEmbedUrl` accepts the address (an `https` Google embed address). The frame is created only once the dialog opens, and with no valid address only the picture and text show. It fills the width it is given (`MapEmbed.client.tsx`, `src/platform/lib/googleMapsEmbed.ts`).
- `Section` `placement="inline"` draws only its tone, with no container or padding, for a block inside a page section's cell (`Section.tsx`, #884).
- A `MetaList` value can shrink inside its row, so a clamped or truncated value stays on its line instead of widening the list (`MetaList.tsx`).
- `FORM_MESSAGES` are the fixed texts for a failed send ("offline", "failed"); each form adds only its own cases (`formMessages.ts`, #204).
- `ProgressBar` is a native `<progress>` with a required `label` for screen readers; its fill comes from the element's own value (no inline style), a value is kept between 0 and `max`, and a `max` of 0 shows an empty bar. Callers always write the numbers beside it (`ProgressBar.tsx`, #939).
- `Alert` announces itself unless `live={false}`: errors interrupt, other tones wait their turn (`Alert.tsx`); the `info` tone is blue, from the `info` and `info-strong` theme tokens (#818).

## Shared pieces it uses

- Related notes: [theme](../theme/README.md) (chart tokens; its `ThemeSelector` uses `Field`), [rich text](../richtext/README.md) (renders charts and blocks with the kit, and the "On this page" menu), [shared Payload code](../payload/README.md) (`AdminBar` reads `isStaffRole`).
- Helpers from `src/platform/lib/` (`cn`, `getMediaUrl`, chart `spec`/`table`, `googleMapsEmbed`, `getURL`) and `src/platform/payload/roles.ts`; `@/cssVariables` and `@/imageQualities` for images.

## Rules and the tests that protect them

- Pages and modules use the kit, never raw `a`, `button`, `input`, `select`, `textarea`, `details`, `summary` or `img`; the native element lives inside a kit component (guard rail 2). Lint bans them outside `src/platform/ui/` (`eslint.ui-kit.config.mjs`).
- Sizes and scroll margins read one variable each: `layoutSizes.test.ts`, `scrollMargin.test.ts`.
- The registry's order and the text fallback: `chart/chartRegistry.test.ts`; every adapter's markup (no `style`, no colour literals, real text, axe): `chart/chartAdapter.contract.test.tsx`.
- Chart libraries stay in the adapters: `chart/chartLibraries.lint.test.ts`; the browser never gets a library or the spec rules through the zoom: `chart/ChartZoom.imports.test.ts`.
- Chart colours, the six-part limit and the seven-step ramp: `chart/chartPalette.test.ts`; the breakdown: `chart/adapters/breakdown/breakdownAdapter.test.tsx`.
- Each component's behavior and accessibility: its `*.test.tsx` beside it (`Button`, `Link`, `Field.client`, `LoadMore.client`, `MapEmbed.client`, `AdminBar.client`, `OnThisPage.client`, `Dialog.client`, `Toast`, `ProgressBar` and others).

## Boundaries

- It imports only from `src/platform/` and no module (0008; no file here imports `@/modules`). `index.ts` exports the small primitives; larger ones are imported by file so a client component that needs a Button doesn't bundle them (`index.ts`).

## Decisions

[0008](../../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md), [0018](../../../docs/architecture/decisions/0018-charts-behind-our-own-port.md).

## Known gaps

- Tone names differ across `Alert`, `Badge` and `Card` (#769).
- `VersionCheck` has no test of its own.
