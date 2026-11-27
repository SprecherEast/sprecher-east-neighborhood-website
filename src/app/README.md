---
name: 'Site shell'
type: feature
summary: 'layout, sitemap, proxy (bounded paging), headers, Payload config.'
aliases: ['app shell', 'composition root', 'payload config', 'proxy']
relationships: []
---

# Site shell

The files that put the modules together. The root layout, home page, error and not-found pages and the version and preview routes under `src/app/(frontend)/`; `sitemap.ts`, `robots.ts` and `global-error.tsx` under `src/app/`; the proxy (`src/proxy.ts`); and the Payload config (`src/payload.config.ts`), where every collection, global, plugin and job is listed. Modules never import each other, so this is the one place they meet (decision 0008). Each page's own note is its module's; the list of screens is the [screens reference](../../docs/reference/routes.md), the addresses the [endpoints reference](../../docs/reference/endpoints.md).

## How the pieces link

- **The config** lists the collections of [events](../modules/events/README.md), [news](../modules/news/README.md), [directory](../modules/directory/README.md), [accounts](../modules/accounts/README.md), [verification](../modules/verification/README.md), [agents](../modules/agents/README.md), [site](../modules/site/README.md) and `media`, the plugins (SEO, redirects, nested docs, search, form builder, MCP), the SQLite adapter, the email adapter, the jobs and their access, and the GraphQL rule that refuses the account verify mutation (`src/payload.config.ts`). It then restricts edit locks and job stats ([Shared Payload code](../platform/payload/README.md)).
- **The layout** joins the header and footer, the account slots, the theme (`InitTheme`, `Providers`, `ThemeDecoration`), the visit counter and `VersionCheck` ([theme](../platform/theme/README.md), [platform services](../platform/service/README.md), [UI kit](../platform/ui/README.md)); the page-builder's block registry is `[slug]/pageBlocks.tsx` ([site](../modules/site/README.md)).
- **The sitemap** reads each module's slug list under its own cache tag and leaves out account pages (`sitemap.ts`).
- **Response headers** come from `next.config.js`: the `/api/` ones are in the [Payload routes note](<(payload)/README.md>), the pages that refuse framing in the [accounts note](../modules/accounts/README.md).
- **Libraries doing real work:** Next.js (routing, caching, metadata) and Payload.

## Behaviors and events

- **The proxy runs before any page and answers 404 for a malformed paging address** (`/posts/page/zz`, `/events/list/x/1`, a category slug with the wrong shape), because Next would otherwise cache the 404 and a flood of junk URLs could grow the page cache without limit (#119); `/events?category=<slug>` redirects to the category's own page; the admin's Forgot and Verify pages redirect to the site's (`src/proxy.ts`).
- **The sitemap is rendered on request** and each list stays in the data cache until a save expires its tag, or 10 minutes, since a scheduled publish runs outside a request and cannot expire tags (`sitemap.ts`, decision 0011, #141).
- **`next build` skips the type check** (`typescript.ignoreBuildErrors` in `next.config.js`; CI's `tsc --noEmit` does it), so a green build proves nothing about types; stated in [`docs/project.md`](../../docs/project.md).
- **The home page re-renders every 10 minutes** (`page.tsx`); a failure of the layout itself shows `global-error.tsx`, which brings its own `<html>` and shows no error text (#521).
- **The OAuth discovery documents answer under `/.well-known/`** through `rewrites` in `next.config.js` (the routes live under `/oauth/discovery/`, owned by the [agents](../modules/agents/README.md) note), and the config lists the OAuth clients and tokens collections (`next.config.js`; `src/app/wellKnownRewrites.test.ts`). Only the protected-resource document's path for the MCP address is served (RFC 9728 ties a document to the resource whose path it carries). The two connection pages, `/oauth/authorize` (reads no session) and `/oauth/approve`, and `/oauth/token` are the agents note's too (`src/app/(frontend)/oauth/`).
- **`/api/version`** answers the build's id for `VersionCheck`; `/next/preview` and `/next/exit-preview` start and end draft mode for the admin's preview (`preview` needs `PREVIEW_SECRET`); `/next/seed` runs the demo seed for an admin where it is on ([Seed and preview accounts](../endpoints/seed/README.md)).

## Shared pieces it uses

- Every module's public entries, `src/platform/` (theme, UI kit, SEO, payload helpers), and `getServerSideURL()` for the site address.

## Rules and the tests that protect them

- **Paging addresses are a bounded set:** page 1 to the maximum, two event scopes, a category slug with a valid shape (`src/proxy.ts`, `src/platform/lib/paging.ts`; `src/proxy.test.ts`).
- **The config wires every module once and no one can skip a rule:** roles, protected fields, row counts, review queue and scheduled publishing are each tested against the real config (`src/payload.config.test.ts`, `src/payload.config.roles.test.ts`, `src/payload.config.protectedFields.test.ts`, `src/payload.config.scheduledPublishing.test.ts`, `src/payload.config.rowCounts.test.ts`).
- **Account pages stay out of the sitemap and search results** (`sitemap.test.ts`, `src/app/(frontend)/notIndexed.test.ts`); the layout's metadata and counter: `src/app/(frontend)/layout.test.tsx`, `src/app/nextConfigEnv.test.ts`; error pages: `src/app/global-error.test.tsx`, `src/app/(frontend)/error.test.tsx`; icons and critical hints: `src/app/icons.test.ts`, `src/app/criticalHint.test.ts`.

## Boundaries

- This is the only layer that may import several modules; the lint rules (`eslint.boundaries.config.mjs`) keep modules from importing each other and pages from reaching into a module's inside.

## Decisions

[0008](../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md), [0011](../../docs/architecture/decisions/0011-scheduled-publishing-runner.md); issues #115, #119, #521.

## Known gaps

- `src/environment.d.ts` types the environment variables by hand; the full list of variables is in [`docs/project.md`](../../docs/project.md).
