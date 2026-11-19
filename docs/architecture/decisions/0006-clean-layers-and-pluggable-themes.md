# 0006: Clean layers inside each module, and pluggable themes

- **Date:** 2026-10-20
- **Status:** Accepted. Point 5 (one theme per build) is superseded by
  [0012](0012-runtime-themes.md).

## Context

The owner wants the site's core idea to stay stable and portable: easy to upgrade, and possible to
show through a different presentation (a redesign, a feed, a future app) without an overhaul. He
also wants the look separated from the code, so a theme can be swapped in.

Today the business rules sit inside pages and components, components read Payload documents
directly, and `globals.css` mixes Tailwind setup, token values and base styles. Components also use
39 raw palette classes (32 `white`, 6 `black`, 1 `red`, mostly text and overlays on photos), 8
hex or `rgba()` values and 2 inline styles, all of which ignore the theme.

## Decision

1. **Layers inside each module** ([0001](0001-modular-monolith.md) keeps the split by business
   area). The domain (types and rules in plain TypeScript) depends on nothing. The application
   layer (`use-cases/` and `actions.ts`) depends on the domain. Adapters (`data/`,
   `cms/`, outside services) and presentation (`app/`, `ui/`) depend on the domain and, for
   presentation, on the application layer. Use cases return plain objects (DTOs), never Payload
   documents.
2. **One shortcut: no port where Payload already is one.** Use cases call `data/` functions
   directly ([0002](0002-no-repository-layer.md)), so the application layer does depend on an
   adapter. Interfaces stay at the real seams: outside services, the clock, and event sources.
3. **Headless behaviour, presentational components.** Interaction logic (filters, paging, toggles)
   goes in hooks that render nothing. Components take props and render; they hold no rules.
4. **The theme is a token set behind a contract.** `platform/theme/tokens.ts` names every
   semantic token (background, foreground, primary, muted, border, ring, radius, plus `on-image`
   and `scrim` for text and overlays on photos). `src/themes/default/theme.css` gives every token
   a value for light and dark mode. The Tailwind mapping (`@theme inline`) is written once against
   the token names. Components use only token classes. A test checks the theme against the
   contract, including WCAG AA contrast. One theme folder today; a second is added only when a
   second look is needed.
5. **Reasonable limits.** One theme is active per build; switching themes at runtime beyond light
   and dark is out of scope. The Payload admin keeps its own look. Until #146 adds `on-image` and
   `scrim`, `white` and `black` stay allowed for text and overlays on photos.

## Consequences

- The core can be tested without Next.js or a database, and survives a Payload or Next.js upgrade
  with changes only in adapters.
- A new look is new token values (or a second theme folder) plus screenshots, not edits across
  components.
- More files per feature (domain, use case, mapper, component), and authors must learn where each
  goes. The [README](../README.md#where-does-it-go) table and lint rules (#130, #146) carry that.
- Some components keep Payload types (blocks, heroes, `RichText`, `Media`), because their shape is
  the CMS's.

## Links

- Issues: #127 (restructure), #146 (pluggable themes), #130 (lint guardrails)
- Martin, "The Clean Architecture": source code dependencies "can only point inwards"
  (https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- Tailwind CSS v4, theme variables and `@theme inline`
  (https://tailwindcss.com/docs/theme)
