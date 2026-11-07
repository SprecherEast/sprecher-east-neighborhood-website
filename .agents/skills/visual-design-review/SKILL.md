---
name: visual-design-review
description: Design review of a change to how the Sprecher East site looks — screenshot the affected pages at six widths in light and dark themes, judge them against the design guidelines in priority order, and report each finding with the pattern and code that fixes it. Use before opening or updating a PR that touches CSS, Tailwind classes, markup, components or images, and when asked for a design audit.
---

# Visual design review

Required for any diff that touches CSS, Tailwind classes, HTML structure, component markup, or
image treatment. Skip it for backend-only, config-only, or docs-only changes. Fix every Critical
and High finding before opening the PR.

The reviewer acts as a design director: it evolves the existing design within the brand and the
layout system, and never redesigns the site from scratch.

## 1. Screenshot

1. Start the dev server if it isn't running: `npm run dev` (http://localhost:3000).
2. Screenshot every affected page with Playwright (the Playwright MCP server, or a Playwright
   script) at the six widths in the
   [viewport table](../../../docs/guidelines/nextjs-tailwind.md#responsive-design--6-viewport-testing)
   (320, 430, 768, 1024, 1280 and 1920 px), in both themes: `data-theme="light"` and
   `data-theme="dark"` on `<html>`.
3. Read the source when you need to know which classes or markup produce what you see.

## 2. Judge, in priority order

| Priority | Category               | Impact   | Check                                                       |
| -------- | ---------------------- | -------- | ----------------------------------------------------------- |
| 1        | Contrast & Readability | CRITICAL | Every text legible on its background, in both themes        |
| 2        | Image Treatment        | CRITICAL | Overlays subtle, images stay vivid, no heavy gradients      |
| 3        | Section Transitions    | HIGH     | Sections flow into each other; no harsh color boundaries    |
| 4        | Spacing & Rhythm       | HIGH     | Consistent spacing scale, generous whitespace               |
| 5        | Typography Hierarchy   | HIGH     | Clear size and weight contrast; at most 3 font sizes a view |
| 6        | Color Harmony          | MEDIUM   | Design tokens only; the palette feels cohesive              |
| 7        | Component Polish       | MEDIUM   | Consistent border radius; hover and focus states            |
| 8        | Animation & Motion     | LOW      | 150–300 ms transitions; no janky layout shifts              |
| 9        | Symmetry & Alignment   | HIGH     | The baseline; mobile order holds                            |

Symmetry and alignment is HIGH although it is listed last: judge every visual change against the
baseline in
[Symmetry and alignment](../../../docs/guidelines/ui-ux-design.md#symmetry-and-alignment)
(alignment, centering, spacing, margins, symmetry, repeated patterns, proportion, hierarchy,
contrast, consistent components, overflow, images, white space, typography, finished-page
inspection, keyboard and screen-reader accessibility, near-field form errors, and subtle
motion that respects reduced-motion). Report a clear break of that baseline as a finding. Do not
require extras beyond it. On small screens the order is the page menu,
the page content, then the related content.

Then the first-impression tests: the 3-second test, the squint test, the comparison test (next
to a polished product site), the theme test (both themes), and the edge test (narrowest and
widest widths).

The standards behind each category are in [UI/UX design](../../../docs/guidelines/ui-ux-design.md).
Flag the [anti-patterns](../../../docs/guidelines/frontend-patterns/README.md#anti-patterns-to-flag)
as bugs.

## 3. Report

Every finding has:

1. **Severity**: CRITICAL, HIGH, MEDIUM or LOW.
2. **What's wrong**: the visual problem, with the width and theme where it shows.
3. **Pattern to apply**: by name, from the [frontend pattern library](../../../docs/guidelines/frontend-patterns/README.md)
   (for example "Anchored Hero", "Frosted Glass Text Panel", "Background Alternation").
4. **Code snippet**: the Tailwind, CSS or JSX from the library, adapted to the component.
5. **Files to change**.

If no pattern fits, write a new one, test it at all six widths, and add it to the library before
prescribing it.

Use design tokens (`src/platform/theme/tokens.ts`) in every fix, and name them. Never hardcode a
color; the one exception is `rgba(0,0,0,…)` for image scrims and shadows, where no token fits.

End with an **implementation plan**: findings grouped into tasks, with the affected files, the
tokens, and a rough effort for each, plus any pattern worth adding to the design system.
