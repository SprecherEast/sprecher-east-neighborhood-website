# Next.js 16 and Tailwind CSS v4 Patterns

Technical patterns for Next.js App Router pages and Tailwind styling in this codebase.

## CMS Page Routes

The `src/app/(frontend)/[slug]/page.tsx` pattern:

1. `generateStaticParams()` — lists all pages (`listPageSlugs()` from `@/modules/site/server`), returns `{ slug }` array
2. `Page` component — resolves slug (default `'home'`), fetches page via cached query (`getPageBySlug()`), renders `<PageHero>` (when the page has a hero) + `<RenderBlocks>`
3. `generateMetadata()` — calls `generateMeta({ doc })` from `src/platform/seo/generateMeta.ts`

All page queries use `cache()` from React to deduplicate fetches between Page and generateMetadata.

## Custom Collection Routes

For non-CMS pages like `/posts`, `/events`, `/resources`, `/faq`:

```
export const dynamic = 'force-static'
export const revalidate = 600
```

Fetch data through the owning module's use cases (from its `server.ts`), whose `data/` queries call the Payload Local API (not Route Handlers). Use `select` to limit returned fields and `depth` to control relationship population.

## Metadata and SEO

**IMPORTANT**: The root layout (`src/app/(frontend)/layout.tsx`) has `title.template: '%s — Sprecher East'`. This automatically appends the brand name to every page title.

- **Never append brand name** in `generateMeta()`, page metadata, or seed data `meta.title`
- Set `meta.title` to the page name only: `'Home'`, `'About'`, `'Contact'`
- The layout template handles branding — setting `title: 'About'` produces `'About — Sprecher East'`
- Use `generateMeta()` from `src/platform/seo/generateMeta.ts` for CMS pages. Collection detail pages (`/posts/[slug]`, `/events/[slug]`) must override `openGraph.url` with the correct route prefix — `generateMeta` only produces generic `/${slug}`.
- For custom routes, return `{ title: 'Page Name', description: '...' }` directly
- When writing fallback strings with template literals, always guard against null/undefined: `event?.title ? \`Details for ${event.title}\` : ''`— never`\`Details for ${event?.title}\``which produces`"Details for undefined"`
- The SEO plugin `generateTitle` (`src/payload.config.ts`) returns the page name only — never append brand name there either. Fallback should be `'Sprecher East'` (not empty string) so the admin UI pre-fill is useful

## Server vs Client Components

- Default to Server Components (no directive needed)
- Push `'use client'` to leaf components that need interactivity (forms, theme toggle, search)
- Use children-as-props pattern to keep parents as Server Components
- Never import server-only code (Payload, fs, crypto) in client components

## Caching

- Use React `cache()` to deduplicate server-side fetches within a request
- In afterChange hooks, use `revalidatePath()` for paths, and expire cache tags with `expireCacheTag()` from `src/platform/payload/expireCacheTag.ts` rather than `revalidateTag()` (`docs/project.md`, Known Gotchas)
- Never call Route Handlers from Server Components: fetch through the owning module's use cases
- For site URL, use the shared `getServerSideURL()` from `src/platform/lib/getURL.ts` (see the DRY principle in [`development.md`](development.md#dry--dont-repeat-yourself))
- Static pages use `revalidate = 600` (10 minutes) as default ISR interval

## Styling Rules

**IMPORTANT**: Never use inline CSS (`style={}`) or hardcoded hex colors. All styling goes through Tailwind utility classes using design token names.

- Use semantic token classes: `bg-primary`, `text-foreground`, `border-border`, `bg-surface`
- Token names are listed in `src/platform/theme/tokens.ts`; their values are in `src/themes/default/theme.css`
- On photos use `text-on-image` and `scrim` overlays (`from-scrim/60`); on brand bands `text-primary-foreground`; for dark chrome (admin bar, code) `bg-inverse` and `text-inverse-foreground`. Lint fails on a raw palette class (`text-white`, `bg-blue-500`) or a hex/`rgba()` colour in a class (`eslint.theme.config.mjs`, #146)
- Dark mode uses `[data-theme='dark']` selector — tokens auto-switch, no manual dark: prefixes needed for token colors
- Container: use the `container` class (max-width with auto margins)
- Sizes the whole site shares (the article reading width, a short page's and a hero's least height, a list page's top and bottom space) are variables in `globals.css` with their classes in `src/platform/ui/layoutSizes.ts`: import `READING_WIDTH`, `PAGE_MIN_HEIGHT`, `HERO_MIN_HEIGHT` or `PAGE_SHELL`, never type `48rem`, `60vh` or `80vh` again (#616)
- Chart colours are `chart-1` to `chart-6` (`bg-chart-1`, `text-chart-1`, `fill-chart-1`…). Use them in order: adjacent pairs are only clean that way. A chart can ask for the warm set (orange and gray, `chart-warm-1` to `chart-warm-6`), which meets the same contrast pairs. Colour is never the only cue: some neighbouring pairs are close for colour-blind readers (blue-yellow separation is low), so every chart also has direct labels, gaps between marks or hatching. Each passes 3:1 on `background`, `surface` and `card` in light and dark (`CHART_PAIRS`, checked by `themes.test.ts`, #659). Text never sits on a colored mark: values and labels use the text tokens. Never use red or green to show up or down (neutrality rule in `brand-voice.md`)
- Font: Poppins loaded via `next/font/google` in layout, applied as `--font-poppins` CSS variable

## Design Tokens

Each token is named in `src/platform/theme/tokens.ts` and valued, for light and dark, in
`src/themes/default/theme.css`: that file is the one place the values live. Components use them
through the Tailwind classes `src/platform/theme/tailwind.css` maps them to (`bg-primary`,
`text-muted-foreground`). How the pieces fit is in the
[theme note](../../src/platform/theme/README.md).

## Dates and Timezone

The site timezone is configured via `SITE_TIMEZONE` env var (default: `America/Chicago`). All timezone logic lives in `src/platform/lib/timezone.ts` — never hardcode timezone strings elsewhere.

- **All date comparisons** (e.g., "upcoming" vs "past" events) must use the site timezone, not server-local time. The VPS runs UTC — `new Date().setHours(0,0,0,0)` gives midnight UTC, not midnight site time.
- Use `startOfToday()` from `src/platform/lib/timezone.ts` for "today" cutoffs in Payload queries
- Use `SITE_TIMEZONE` from `src/platform/lib/timezone.ts` when you need the raw timezone string (e.g., for `toLocaleDateString`)
- **Day-only dates vs datetimes**: Payload stores day-only dates (`pickerAppearance: 'dayOnly'`) as midnight UTC (e.g., `2026-03-03T00:00:00.000Z`). When **displaying** these, use `timeZone: 'UTC'` so "March 3" doesn't render as "March 2". When displaying actual datetimes with time components, use `SITE_TIMEZONE`.
- `formatDateTime()` and `formatDateShort()` in `src/platform/lib/formatDateTime.ts` handle this automatically — they detect day-only timestamps (ending in `T00:00:00.000Z`) and use UTC, otherwise use the site timezone.
- `startOfToday()` converts the current site-local date to midnight UTC to match Payload's day-only storage format for correct query comparisons.

## Images

- Use `next/image` for all images — never raw `<img>` tags
- Set `priority` on hero/above-fold images
- Below-fold images use default lazy loading
- Payload Media component (`src/platform/ui/Media.tsx`) handles both image and video

## Responsive Design — 6-Viewport Testing

Changes that affect rendering (CSS, Tailwind classes, HTML structure, component markup) **must** be visually verified at 6 viewports before committing. Use Playwright (the Playwright MCP server, or a Playwright script) to screenshot affected pages. Skip for backend-only, config-only, or docs-only changes.

**Test viewports (min + max of each breakpoint range):**

| #   | Name      | Width  | Represents                      |
| --- | --------- | ------ | ------------------------------- |
| 1   | Mobile S  | 320px  | iPhone SE, smallest phones      |
| 2   | Mobile L  | 430px  | iPhone 15 Pro Max, large phones |
| 3   | Tablet S  | 768px  | iPad Mini, small tablets        |
| 4   | Tablet L  | 1024px | iPad Pro 11", large tablets     |
| 5   | Desktop S | 1280px | Laptops, small monitors         |
| 6   | Desktop L | 1920px | Full HD monitors                |

**Tailwind breakpoints (for reference):**

- `sm: 640px` — mobile → tablet transition
- `md: 768px` — tablet starts
- `lg: 960px` — desktop starts (a phone's "desktop site" mode is about 980px wide, #545)
- `xl: 1280px` — wide desktop
- `2xl: 1536px` — ultrawide

**Responsive CSS rules:**

- Mobile-first: base styles are for 320px, then layer `sm:`, `md:`, `lg:`, `xl:` overrides
- Never hardcode pixel widths on content elements — use `max-w-*`, `w-full`, percentages, or grid/flex
- Test text wrapping at 320px — long titles and descriptions must not overflow
- Images must be `w-full` or responsive within their container — never fixed dimensions that break on small screens
- Touch targets (buttons, links) must be at least 44x44px on mobile (WCAG 2.5.8)
- Horizontal scrolling on any page at any viewport is a bug — fix immediately
- Use `container` class for consistent max-width with auto margins across breakpoints

**Workflow:**

1. Make the UI/UX change
2. Start dev server if not running (`npm run dev`)
3. Screenshot affected pages at all 6 viewports with Playwright
4. Inspect each screenshot — check alignment, spacing, text wrapping, image sizing, touch targets
5. Fix any issues found
6. Re-screenshot to verify fixes
7. Only commit when all 6 viewports look correct
