# Component set: shared components

Part of the [UI inventory](inventory.md) (#170), for epic #163.

To see every component and variant at once, run `npm run dev` and open `/dev/gallery`
(`src/app/(frontend)/dev/gallery/`, development only, #466).

> **Status: approved.** The owner approved this set on 2026-10-21, with the merges he asked for
> that day (fewer components, each composed from the others, never a second button). Components
> are built in the order below, each in its own issue under epic #163.

The set comes from the [element tables](inventory.md#the-files): every element maps to exactly one
component and variant ([coverage check](component-set-modules.md#coverage)). This page covers the
shared components; [component-set-modules.md](component-set-modules.md) covers the components that
belong to one business area, what isn't needed yet, and the coverage table.

## Rules every component follows

- **Where:** shared primitives in `src/platform/ui/`, the rich-text renderer in
  `src/platform/richtext/`, area components in a module's `ui/`
  ([architecture](../architecture/README.md#where-does-it-go)). One component per file, under 250
  lines.
- **Variants with `cva`**, named by purpose (`primary`, `muted`), never by colour. Colours come
  from semantic tokens only ([rule 9](../architecture/README.md#dependency-rules)).
- **Plain typed props.** No component imports Payload; it gets `ImageRef`, `RichTextValue` or the
  module's own types. CMS links go through one `resolveLink()` mapper into a `ResolvedLink`
  (`href`, `label`, `external`, `appearance`; the type is in `src/platform/lib/content.ts`).
- **Proven libraries behind our API:** Radix for behaviour (select, checkbox, dialog),
  react-hook-form with Zod for forms (epic #163).
- **Composition over flags:** `Card` and `Field` are built from small parts; looks are variants,
  not booleans.
- **One implementation per element.** `Button` is the only thing that draws a button: a form's
  submit, a card's action, "Load more", a toast's action and the copy button all place a `Button`.
  `Link` only ever looks like text. A component that would differ from another only in a few
  classes becomes a variant of it instead.
- **Accessible by default:** focus ring, 44 px touch targets on phones, labels linked to controls,
  errors announced, `aria-current` on the current page.

Each group below links its generated page: every component with its props, variants and the
modules and routes that import it (`npm run docs:generate`, checked by `npm run docs:check`, #718).
The page you are reading keeps what code cannot say. Which inventory element each component covers is
in the [coverage check](component-set-modules.md#coverage).

## Actions

Components: [actions](../reference/components/actions.md).

**The skip link (L1)** is `Button · primary` with `href="#main"`, hidden until it has focus: it
looks like a button, so it is one.

**`Button · {appearance}` (B12).** The CMS link field stores `appearance` as `default` or
`outline` (`src/platform/payload/link.ts:10`, `:14`). `default` maps to `Button · primary` and `outline` to
`Button · secondary`. The high-impact hero and the CTA block ignore the field today and style their
buttons by position (H2, H3, B14, B15).

## Form fields

Components: [form fields](../reference/components/form-fields.md).

**`Field` controls.** A field holds exactly one control, a part of `Field` like `CardBody` is a part
of `Card`: `Field.Input`, `Field.TextArea`, `Field.Select` and `Field.Checkbox` (the field switches to
`layout: inline`). The frame passes the control its `id`, `aria-describedby` and `aria-invalid`, so
no control repeats that wiring. Each control works with a controlled value or react-hook-form's
`register`. In the coverage table, `Field · email` means a field holding `Field.Input type="email"`.

## Display

Components: [cards](../reference/components/cards.md), [display](../reference/components/display.md), [sections and page headers](../reference/components/sections.md) and [media](../reference/components/media.md).

**`Badge`** (#952) has two sizes (`size`: `sm`, the default, and `md`, slightly bigger words and icon), set with the variant. A mark that must stand out among small labels, such as a state mark on the plan, uses `md`; labels stay `default`. Its test covers both sizes and the plan's state mark; the gallery shows `md`.

**`ShareBar`** (#1018, #1020) draws one whole as a square bar of slices, each exactly as wide as its share, in three gray tones and at most one `highlight` slice. The highlighted slice is the tabs' glassy green with an outline, standing 5 px above the other slices (`SHARE_BAR_RISE`, one number to change); its two side edges run 10 px down and curve into the top edge of the panel under the bar (the way `Tabs` joins a tab to its panel); the panel holds the children. Each edge and its curve are one line, and once the bar knows its width every edge sits on a whole pixel, so the corners stay crisp at any screen width. A slice too narrow for its label (under 8 percent) gets the label above it with a tick. It is one SVG with a `label` for screen readers, so widths are attributes, never inline styles, and the caller writes the numbers beside it. `ShareBarSwatch` is the matching key square. Its test covers the widths, the pixel snapping, the labels, the outline and axe; the gallery shows it.

**`AmountBar`** (#1020) draws one amount as a single bar split into parts, each exactly as wide as its share, with the title and whole amount above it and, when there is more than one part, a key with each part's dollars. A part marked `hatch` (an added amount, the proposed increase) is the same green, striped. Widths are attributes; the caller formats every amount. Its test covers the widths, the hatch, the key and axe; the gallery shows it.

**`ProgressBar`** (#939) shows how far along something is, as a native `<progress>` that screen readers read as a named bar (`label`), in two sizes (`sm`, `md`). The fill's width comes from the element's own value, not an inline style, and a `max` of 0 shows an empty bar. The caller always writes the numbers next to it ("3 of 8 done"), so the bar is never the only signal. Its test covers the clamping and axe; the gallery shows it.

**`MapEmbed`** (#764, #884) is a small map picture over its text, filling the width it is given: the page's Section decides how wide it is and where it sits. It opens
a live Google map in a `Dialog`
when a neighbor taps the picture or the "View the larger map" button. The frame is created only
after that tap, so the page asks Google for nothing before it, and then Google receives the visit
(the page's origin only, `strict-origin-when-cross-origin`). Only Google's keyless embed addresses
("Embed a map" and My Maps) are accepted (`toGoogleMapsEmbedUrl`); with none, the picture and text
show and there is no button. Its test checks the closed and the open dialog with axe (the frame
removed, since jsdom can't run axe across one), the gallery shows both states, and its props are in
the [media page](../reference/components/media.md).

**`FeaturedImage`** (#1013) is the picture of a post or an event, at the top of the article's column: the whole picture at its own proportions, never cropped, up to the reading width from the column's left edge, loading early (it is the first image seen), with its credit under it. With no picture it draws nothing and leaves no gap. `ArticlePage` draws it, and the page header above it is the plain `PageHeader` `band` (a themed surface, no picture), so a picture that carries text stays readable at every width. Its test checks the proportions, the reading width, the early load, the empty case and axe; the gallery shows both cases.

**`Figure`** (#816) is a small picture that floats right in an article, about two fifths of the text
column by default (`size`: `third`, `two-fifths` or `half`), with the text wrapping on its left from
`md` up; below `md` it fills the column between paragraphs. Its label ("Figure 2-9") sits in a
neutral badge with the short caption. A click or tap opens the `Zoom` dialog with the large picture,
and beside it (under it on a narrow screen) the long caption and the numbered key: the key never
shows in the small view. Its test covers the float classes, the size, the dialog and axe; the gallery
shows it. `FigureBlock` (#817) is the editor's block: it maps the stored fields to `Figure`'s props
and is shown by the same gallery entry; its test checks the render and axe.

## Feedback and overlays

Components: [feedback and overlays](../reference/components/feedback.md).

**`RouteDialog`** (#946) is a `Dialog` that is a page of its own: it opens over the page that led to it,
and its close button, its back button and Escape all go back one step in the browser's history. It uses the
`center` placement of `Dialog`, a panel over a dimmed page, where the default `sheet` fills the screen.
Next.js intercepts the route for a click inside the site, and a direct visit or refresh shows the full page,
so the address always works. Its test covers the three ways out and axe.

**`Zoom`** (#815) is a small view that opens larger in a full-screen `Dialog`: the Enlarge button, or a
click or tap on the small view, opens it, with focus kept in the dialog and returned to the button on
close. The optional `aside` (a legend, a long caption) shows beside the large view from `lg` and under
it below, and never in the small view; without a `large` view the small view itself moves into the
dialog, drawn once. With scripting off the button is hidden. `ChartZoom` is a thin caller of it, and
`Figure` (#816) is another. Its test covers both layouts, the keyboard, focus return and axe, and the
gallery shows it.

`Alert` has four tones: `info` is blue (`info` and `info-strong` theme tokens, #818), `success` green, `warning` amber and `error` red. Each is a 10% tint with its `-strong` text, checked at 4.5:1 in light and dark, and each has its own icon, so colour is never the only cue.

## Navigation

Components: [navigation and page tools](../reference/components/navigation.md).

## Layout

Components: [layout and page structure](../reference/components/layout.md).

**`PageBackdrop`** (#777) draws an editor's photo faded and grayed behind a page, under its text. The
photo fills the top 28 rem of the page and is washed into the theme's background at both ends, so
it is felt rather than seen and leaves no edge; it is never placed between a title and its content.
It is a decoration: hidden from assistive tech, empty alt, no motion, and the field takes pictures
only (`imagesOnly`). It loads at once (`priority`), at the lighter `IMAGE_QUALITIES.backdrop`. Inside
it, for **all of the page's content** and not only the photo's area, muted text becomes a mix of the
main text colour and the background, and primary-coloured text takes `primary-strong`, so text keeps
AA contrast over the photo in light and dark. With no photo it draws only its children, so a page
without one is unchanged. Its test checks these with axe.

## Rich text (`src/platform/richtext/`)

Components: [rich text](../reference/components/rich-text.md) (`src/platform/richtext/`).

## How many, and what to build first

- **The shared components** are counted and listed in the [generated reference](../reference/components/README.md). The owner's review
  on 2026-10-21 cut nine of the first proposal's 32. Seven were merged: the four input components
  became parts of `Field`, `Heading` became variants of `Text`, `DetailHero` became
  `PageHeader · image`, and `Container` became `Section`'s `width`. Two moved into the one area
  that uses them (next point).
- **Kept in the one place that uses them,** under the rule "add a component when a second screen
  needs it" (#163): the loading placeholder is a style inside `SiteHeader`. The FAQ accordion moved to the
  shared `Disclosure` once `OnThisPage` needed the same `<details>` row (#610), which also has a bare `link` look for "See the smaller pieces" in a breakdown chart (#866). Its chevron turns only for its own box (a selector on the box's own summary, never `group-open:`, which fires for any open box around it, #967), so boxes nest, as on the Plan page.
- **Build order:** `Button` and `Link` (19 and 12 elements), then `Field` and `Form`, then `Card`,
  `Media`, `PageHeader` and `EmptyState`.

## Decided choices

Two parts of the set differed from rules already written down. Both are settled (#426):

1. **Card looks.** The owner kept today's looks (2026-10-26, Claude Code session): the `elevated`,
   `outline`, `muted` and `tinted` variants and the compact `padding: sm` (`p-4`). The card rules
   in [`ui-ux-design.md`](../guidelines/ui-ux-design.md#card-design) now say so.
2. **Plain props for blocks and heroes.** Decided from established practice, as the owner asked:
   [decision 0013](../architecture/decisions/0013-cms-content-through-mappers.md). Blocks and
   heroes take plain typed props, built by a `to…Props` mapper in the module's `data/`, and
   [rule 8](../architecture/README.md#dependency-rules) says so.
