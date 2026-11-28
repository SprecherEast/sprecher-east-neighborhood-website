---
name: 'UI kit'
type: platform-area
summary: 'shared components; raw tags banned outside.'
aliases: ['shared components']
relationships: [{ 'type': 'depends-on', 'target': 'src/platform/theme/README.md' }]
---

# UI kit

The shared components every page and module builds with (`src/platform/ui/`): what they do beyond their props, and which values they share with the CSS. Not in the CMS, but the rich-text blocks an editor places are drawn with them ([rich text](../richtext/README.md)). Props, variants and where each is used: [shared components reference](../../../docs/reference/components/README.md); rules and decided choices: [component-set.md](../../../docs/ui/component-set.md). A change here reaches every page.

## How the pieces link

- **Sizes live once:** `layoutSizes.ts` and `scrollMargin.ts` hold Tailwind classes that read CSS variables from `src/app/(frontend)/globals.css` (`--reading-width`, `--header-clearance`, `--anchor-offset`, the chart widths and the home hero's `--hero-*` values), so a number two files must agree on has one definition (#616; `layoutSizes.test.ts`, `scrollMargin.test.ts`).
- **Buttons of one decision:** `ButtonRow` stacks them on a phone and sets them in a row from the wider layout up, with one gap; `align="end"` right-aligns them (`ButtonRow.tsx`; `ButtonRow.test.tsx`, #1501).
- **Links:** `Button` and `Link` render through `AppLink` (`next/link` for routes, a plain `<a>` for in-page `#` links so keyboard focus moves); `LinkButton` (`CMSLink.tsx`) turns a resolved CMS link into a `Button` (outline becomes `secondary`, `accent` stays orange, anything else `primary`).
- **Media:** `Media` picks `VideoMedia` for a video mime type, else `ImageMedia`; upload paths stay relative so Next optimizes them as local images, with the image's `updatedAt` as cache key (`Media.tsx`, `ImageMedia.client.tsx`, `src/platform/lib/getMediaUrl.ts`). A picture that must stay cropped keeps its subject in view through the upload's focal point (`atFocalPoint`, `src/platform/lib/focalPoint.ts`, #1013); cards never pass it.
- **Article pages:** a post's or event's page heads with a plain `PageHeader` band (optionally over a title photo, `BandBackdrop`, #1024), a `MetaBar` and a whole, uncropped `FeaturedImage` placed by `ArticlePage` (`PageHeader.tsx`, `MetaBar.tsx`, `FeaturedImage.tsx`, `ArticlePage.tsx`, #1013, #1055).
- **Forms:** a `Field` hands its one control its id, `aria-describedby` and `aria-invalid` through one context, and a control outside a `Field` throws (`fieldContext.ts`); `Field.Money` writes the whole-dollar rule in [shared helpers](../lib/README.md) (`FieldMoney.client.tsx`).
- **Libraries doing real work:** Radix (dialog, popover, tabs, select, checkbox, switch, toast), `class-variance-authority` for variants, `react-hook-form` for forms, `lucide-react` for icons.
- **Charts** and the data displays built like them have their own note: [Charts and data displays](chart/README.md). Theme tokens: [theme](../theme/README.md).

### The showcase

- `npm run storybook` opens the component showcase (Storybook, #1424): each component has a `*.stories.tsx` beside it, drawn with the site's own `globals.css` and fonts, with a theme switch (every folder in `src/themes/`), a light/dark switch and the six widths of the [responsive table](../../../docs/guidelines/nextjs-tailwind.md#responsive-design--6-viewport-testing). Setup and its checks are in `.storybook/` (`viewports.test.ts`, `themes.test.ts`, `fonts.test.ts`).
- It is public at https://dev.sprechereast.com/storybook/index.html (`/showcase/` is the native showcase's page, #1528), rebuilt by every production deploy; a preview that changes a story or a shared component gets its own copy ([`ops/developer-site.md`](../../../ops/developer-site.md), #1459). Stories cover only part of the kit; the old gallery stays until the rest has them.
- **Showcase examples** (#1532, epic #1528): the native showcase that replaces both is built from a `*.examples.tsx` file beside each component (and a `*.examples.client.tsx` for an example with a handler or state; `defineExample` in `example.ts`), from `docs/reference/showcase-index.json` and from the import map `showcaseRegistry.ts`, which `npm run docs:generate` builds from the types, the imports and those files (not in git; `npm test`, `npm run dev`, `npm run build` and `npm run typecheck` build it first when it is missing). The format, and what an example may not do, is in [showcase-examples.md](../../../docs/ui/showcase-examples.md); `examples.test.tsx` renders every example with axe and `examples.server.test.ts` draws the server ones with the framework's server renderer.

## Behaviors and events

- **`VersionCheck`** (root layout) polls `/api/version` every 30 s while the reader is active and the tab visible; a different build shows a toast with Refresh that stays until closed; a dismissed build is not offered again; nothing happens when the server reports `development` (`VersionCheck.client.tsx`, `src/app/(frontend)/api/version/route.ts`, #1378).
- **`AdminBar`** is always mounted but hidden until Payload's bar reports a signed-in admin or editor; `LivePreviewListener` refreshes the page when the editor saves in Live Preview, mounted only in draft mode (`AdminBar.client.tsx`, #203).
- **`LoadMore`** loads the next page by cursor shortly before the end for 4 pages (`AUTO_LOAD_PAGES`), then the reader clicks; the button is a real link to the next numbered page, so it works without JavaScript (`LoadMore.client.tsx`).
- **`Figure`** floats a small picture right from `md`; its long caption and the larger picture show only in the `Zoom` dialog, opened by an expand icon on the picture (`Figure.tsx`, `Zoom.client.tsx`, #816, #1156).
- **`MapEmbed`** draws a live map only when `toGoogleMapsEmbedUrl` accepts the address and creates the frame only once the dialog opens; the picture carries the same expand icon as `Zoom` (`EXPAND_ICON_BUTTON` in `layoutSizes.ts`, #1426) over its top-right corner, a button of its own opening the same dialog; the picture's own button is for mouse and touch only (out of the tab order), so the keyboard meets two stops, the icon and the text button (`MapEmbed.client.tsx`).
- **`NavMenu`** opens a header item's links by a press, never hover: a popover on a wide screen, `Disclosure`'s `nav` look in the mobile menu (`NavMenu.client.tsx`, #1237). `Dialog` is a full-screen sheet by default; `RouteDialog` is an always-open dialog for an intercepted route whose close, back and Escape all call `router.back()` (`RouteDialog.client.tsx`, #946).
- **Motion:** `prefersReducedMotion()`, `useCountedNumber` and `useReplayProgress` skip to the end under reduced motion; `holdScrollAnchor()` stops the browser's scroll anchoring moving the page while a row expands (`motion.client.ts`, #1048, #1163).

## Shared pieces it uses

- Helpers from `src/platform/lib/` (`cn`, `getMediaUrl`, chart `spec` and `table`, `googleMapsEmbed`, `getURL`) and `src/platform/payload/roles.ts`; `@/cssVariables` and `@/imageQualities` for images. [Shared Payload code](../payload/README.md): `AdminBar` reads `isStaffRole`.

## Rules and the tests that protect them

- **The kit, not raw tags:** pages and modules never use raw `a`, `button`, `input`, `select`, `textarea`, `details`, `summary` or `img`; the native element lives inside a kit component, and lint bans them elsewhere (guard rail 2; `eslint.ui-kit.config.mjs`).
- **A `Disclosure` a reader opens is scrolled into view** just far enough to show its end with a small gap; a box taller than the screen stops with its summary under the sticky header (and the "On this page" bar), so the top wins; closing never scrolls; a box can name a `revealAnchor` that must not go above the header; a box with another `Disclosure` right under it keeps room to show that one's summary (`reveal.client.ts`, `revealShift.ts`, `Disclosure.tsx`, #1152, #1154, #1178; `revealShift.test.ts`, `reveal.client.test.ts`, `Disclosure.anchor.test.tsx`).
- **A chevron turns only for its own box,** so boxes can nest (`Disclosure.test.tsx`, #967); a `listRow` expands over 500 ms (`Disclosure.expand.test.tsx`, #1163).
- **Every tab has a link of its own:** choosing one puts `#<anchor>` in the address (replacing history so Back leaves the page); a name repeated by a later tabbed block is numbered `-2`, `-3`; a link to a heading inside a closed tab opens that tab first; the named tab shows before any script runs through CSS keyed on the target (`Tabs.client.tsx`, `theme/tabs.css`, #1097, #1309, #1333; `Tabs.client.test.tsx`, `TabsLinks.client.test.tsx`, `TabsContentLinks.client.test.tsx`).
- **The "On this page" menu needs at least 3 sections** and highlights the last heading above a reading line (`onThisPage.ts`, `OnThisPage.client.tsx`; `OnThisPage.client.test.tsx`).
- **Text on a photo stays readable:** `GlassPanel` is the one frosted-glass look and keeps 4.5:1 text over a very bright photo; a title band photo is dimmed so its title meets WCAG AA (`GlassPanel.tsx`, `BandBackdrop.tsx`, #1278, #1024; `GlassPanel.test.tsx`).
- **A brand mark is never altered:** `BrandLogo` draws a provider's logo exactly as supplied, takes no class, and is the one place literal logo colours are allowed (`BrandLogo.tsx`, #1365; `BrandLogo.test.tsx`).
- **`Switch` is a native switch button, not a styled box:** Radix's switch role gives Space, Enter and the announced on or off state, its label (visible, or `hideLabel` for screen readers only) names it and takes the press too, and the 44 px tap area (`TOUCH_TARGET` in `touchTarget.ts`, shared with `Field.Checkbox` and measured in a browser by `e2e/touchTargets.spec.ts`), the thumb's reversed slide in a right-to-left page and the stilled motion under reduced motion are classes the test pins; `Field.Switch` is the same switch under a `Field` (`Switch.client.tsx`, `FieldSwitch.client.tsx`, #1529; `Switch.client.test.tsx`).
- **`Button` with `loading` ignores clicks but stays focusable;** `ProgressBar` needs a `label` and clamps its value (`Button.tsx`, `ProgressBar.tsx`, #939); `Alert` announces itself unless `live={false}` (`Alert.tsx`).
- **Toasts sit under the sticky header in the page** and above everything at the screen's bottom (`Toast.client.tsx`, #1392; `Toast.client.test.tsx`). Each component's behavior and accessibility: its `*.test.tsx` beside it.

## Boundaries

- It imports only from `src/platform/` and no module (0008). `index.ts` exports the small primitives; larger ones are imported by file so a client component that needs a Button does not bundle them.

## Decisions

[0008](../../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md), [0018](../../../docs/architecture/decisions/0018-charts-behind-our-own-port.md).

## Known gaps

- Tone names differ across `Alert`, `Badge` and `Card` (#769).
