# 0012: Themes switch at runtime, on two axes: mode and theme

- **Date:** 2026-10-25
- **Status:** Accepted. Supersedes point 5 of [0006](0006-clean-layers-and-pluggable-themes.md)
  ("one theme is active per build"); the rest of 0006 stands.
- **Issues and PRs:** #370, #146

## Context

Decision 0006 made the look a token set behind a contract, and limited the site to one theme
per build, switching only light and dark at runtime. The owner now wants a baseline theme plus
seasonal themes (Halloween, Christmas, one per season) that an admin can switch in the Payload
admin without a restart, a rebuild or a config change, like a theme in a classic CMS. He also
wants the code ready for other ways to choose a theme later, such as a visitor picker, through a
clear, portable interface (voice session 2026-10-25, quoted on #370).

What established design systems do (researched 2026-10-25, sources on #370):

- GitHub Primer ships one CSS variable file per theme and selects them with attributes on the
  page: one for the mode (light, dark, auto) and one for the theme used in each mode.
- shadcn/ui uses the semantic token names this site already uses (background, primary, muted,
  border, ring…), mapped to Tailwind once with `@theme inline`. Theme editors such as tweakcn
  export in that format.
- The W3C Design Tokens Community Group's first stable format (2025.10) treats brand themes and
  light/dark modes as separate dimensions.
- `next-themes`, the usual Next.js library, supports any list of named themes, sets a `data-*`
  attribute before first paint, and can force a theme.

The one-theme-per-build limit in 0006 was a scope choice, not a technical need: with tokens, each
theme is a small block of CSS variables, the page can carry all of them, and switching flips an
attribute.

## Decision

1. **Two independent axes.** _Mode_ is light or dark and stays on `data-theme`, where the
   existing scoped bands (`data-theme="dark"` on the footer, high-impact hero and call-to-action)
   keep working. _Theme_ is the look (`default`, or a seasonal one) on a second attribute on
   `<html>`, `data-site-theme`. Every theme gives every token a value for both modes.
2. **Themes switch at runtime.** All theme stylesheets ship with the site; changing the active
   theme changes the attribute. No restart, rebuild or redeploy.
3. **Three parts, kept apart:**
   - **Themes** are data: token values per mode, plus the theme options in point 4. A theme
     doesn't know who selects it.
   - **Controllers** choose a theme. The first is a site setting in the Payload admin (a global),
     later with optional date ranges so a seasonal theme turns itself on and off. A visitor
     picker or any other real-time switch is another controller.
   - **One resolver** in `platform/theme/` decides which controller wins and returns the theme
     name. Adding a controller changes the resolver's list, nothing else.
4. **Theme options: our own small contract.** Tokens cover colours, radius, fonts, shadows and
   motion speed. What tokens can't express (header or footer layout variants, animation style,
   decorations such as snowfall or a header ornament) goes in a typed theme-options object in
   `platform/theme/`, with a default for every option, read by the layout through defined slots.
   A theme sets only the options it supports, so a token-only theme needs no code. No industry
   standard exists for this layer; keep it short, because each option is permanent API.
5. **Visitors choose only the mode for now.** The seasonal theme is set site-wide by admins. A
   visitor theme picker is out of scope until the owner asks for it, but nothing may block it.
6. **Order.** First tokenize and modularize (#146: the token contract, one CSS file per theme,
   no raw colours, the theme-options contract). Theme switching is built only once that works.
   Until then, pure visual restyling waits (it would be redone); features continue, using token
   classes only.
7. **Library ladder.** Prefer `next-themes` over extending the template's own provider, if it
   fits the two axes; record what was checked on the issue.

## Consequences

- An admin changes the site's look from the admin, live. A new theme is a stylesheet (for
  colours, one exported from a shadcn-format editor) plus any options it sets.
- Every theme × mode pair is tested against the token contract, including WCAG AA contrast;
  the matrix grows with each theme.
- Scoped bands need both selectors in each theme file (`[data-site-theme='x'][data-theme='dark']`
  and `[data-site-theme='x'] [data-theme='dark']`), so the footer turns dark in every theme.
- Pages carry every theme's variables. At a few kilobytes per theme that is acceptable; revisit if
  themes grow large.
- Theme options are custom API we maintain, which is why the list stays short and each option
  has a default.
- The Payload admin keeps its own look (unchanged from 0006).

## Links

- Issues: #370 (plan and owner decisions), #146 (token contract), #130 (lint guardrails)
- Primer Primitives, themes and data attributes:
  https://primer.style/foundations/primitives/getting-started
- W3C Design Tokens Format Module 2025.10:
  https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/
- shadcn/ui theming: https://ds.shadcn.com/docs/theming
- next-themes: https://github.com/pacocoursey/next-themes
- tweakcn: https://github.com/jnsahaj/tweakcn
