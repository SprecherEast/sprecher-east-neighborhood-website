# Theme

How the site's look is themed: where each colour and size token is named and valued, how a
visitor's light or dark choice reaches the page, and how a theme adds a decoration. The rules
are in [`nextjs-tailwind.md`](../../../docs/guidelines/nextjs-tailwind.md); no content type or
route is involved, so the generated reference has nothing on it.

## How the pieces link

- A token is named in `tokens.ts`, valued in `src/themes/<name>/theme.css` (a light block and a dark block), and mapped to Tailwind classes in `tailwind.css` (`--color-primary: var(--primary)` gives `bg-primary`).
- `themes.test.ts` checks every folder in `src/themes/` sets every token, reading the CSS with `themeFile.ts`.
- Each name in `registry.ts` has a folder in `src/themes/`; `registry.test.ts` checks the two lists match.
- `ACTIVE_THEME` in `registry.ts` is the theme the site shows, and `src/app/(frontend)/globals.css` imports that theme's `theme.css`; `registry.test.ts` checks they agree.
- What tokens can't express is a theme option, with defaults in `options.ts`; `registry.ts` lists the options each theme sets, and `{}` means all defaults (decision 0012).
- Chart colours and their contrast pairs are in `tokens.ts` (`CHART_PAIRS`), checked by `themes.test.ts` (#659).

## Behaviors

- A token marked `both` in `tokens.ts` must be set in light and in dark; one marked `base` (`diagram-marker`, `radius`) is set once. Dark inherits any light token it leaves out (`themeFile.ts`).
- `InitTheme.tsx` is a blocking script in `<head>` of the root layout. Before first paint it sets `data-theme` on `<html>` to the stored choice (`light` or `dark`), else to the system's dark preference, else to `defaultTheme` (`theme.ts`).
- `ThemeProvider.client.tsx` wraps the page (`Providers.tsx`). On mount it reads the stored choice, else the system preference, and sets `data-theme` again: a 404 is served without the layout's `<head>`, so the script never ran there (#413). With no stored choice it follows later changes of the system preference.
- `setTheme(null)` ("Auto") removes the stored choice; `setTheme('light' | 'dark')` stores it. The storage key is `themeLocalStorageKey` in `theme.ts`.
- `ThemeSelector.client.tsx` (Auto, Light, Dark) works but is rendered nowhere, so visitors can't choose; dark mode follows the device (`docs/ui/evidence.md`).
- `ThemeDecoration.tsx` is rendered once in the root layout. It draws the active theme's `decoration` option, or nothing; the default theme has none. The layer is hidden from assistive technology, takes no clicks and is faint (`decorations.css`).
- A decoration's movement stops within 5 seconds and doesn't start when the visitor asks for reduced motion (`decorations.css`, #409).
- The chart reveal and bar-grow effects (`chart-reveal`, `chart-reveal-x` in `tailwind.css`) run only on screen, with motion allowed and scroll-driven animation supported; otherwise charts draw finished. `print-exact` keeps chart marks and legend swatches coloured in print.
- Rich-text colours come from `tailwind.config.mjs` and are all token variables, so a theme recolours posts without touching it; none are inverted for dark, which follows `data-theme`, not the device.
- Components use token classes only: lint rejects raw palette classes and hex or rgb values in classes (`eslint.theme.config.mjs`).

## Shared pieces it uses

- `Field` from `src/platform/ui/` for the selector. The layout (`src/app/(frontend)/layout.tsx`) joins `InitTheme`, `Providers` and `ThemeDecoration`.

## Rules and the tests that protect them

- Every theme sets every token, and the default theme exists: `themes.test.ts`.
- Text pairs pass WCAG AA (4.5:1), chart marks and control borders 3:1, in both modes, including tinted and scrim backgrounds: `themes.test.ts`.
- Theme folders and the registry match; the default theme is undecorated: `registry.test.ts`.
- A theme that sets no options gets every default, and defaults are never mutated: `options.test.ts`.
- The stored or system theme is set on `<html>` when nothing else did: `ThemeProvider.client.test.tsx`.
- A decoration is absent by default and hidden from assistive technology: `ThemeDecoration.test.tsx`.
- Chart effects are screen-only: `chartReveal.test.ts`; print keeps colours: `chartPrint.test.ts`.
- Rich-text colours are theme tokens and cover every colour the typography plugin reads: `prose.test.ts`.
- No raw colours in classes: `eslint.theme.config.mjs`.

## Boundaries

- Imports no module; everything here is shared by modules through `src/platform/`. `ThemeProvider` and `ThemeSelector` are client components, `InitTheme` and `ThemeDecoration` are not.

## Decisions

[0006](../../../docs/architecture/decisions/0006-clean-layers-and-pluggable-themes.md), [0012](../../../docs/architecture/decisions/0012-runtime-themes.md).

## Known gaps

- The theme is fixed per build; there is no runtime switching between themes yet (`ACTIVE_THEME`, decision 0012, #370).
- `InitTheme` guards `localStorage` with try/catch, but `ThemeProvider` and `ThemeSelector` read it unguarded, so a browser that blocks storage can throw there.
