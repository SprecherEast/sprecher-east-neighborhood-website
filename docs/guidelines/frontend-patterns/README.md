# Frontend Design Patterns — Implementation Library

Concrete Tailwind CSS and React patterns for building polished, modern UI. Every pattern here is tested, responsive, and uses the project's design tokens. When the designer recommends a visual effect, the builder pulls the implementation from here.

This is a living library, split by kind of pattern ([index below](#the-library)). When a new
pattern is proven in production, add it here.

## Design Philosophy

**This library is a floor, not a ceiling.** These patterns are proven starting points — use them, combine them, remix them, but never treat them as the only options. The best designs come from creative composition: a frosted glass panel with a subtle parallax background, an anchored hero with staggered text reveal, a split layout with a floating stat strip overlapping the fold.

**What we value:**

- **Minimalism with maximum impact** — every element earns its place; if it doesn't serve the user, remove it
- **Deliberate visual weight** — weight is intentional, never accidental; a layout that is asymmetric looks deliberate and balanced
- **Smooth contextual flow** — each section should lead naturally to the next; the user should never wonder "why is this here?"
- **Intuitiveness for the layman** — a resident who has never built a website should find navigation, CTAs, and content hierarchy immediately obvious
- **Elegance over flashiness** — subtle shadows beat loud gradients; a 200ms ease-out beat a 500ms bounce; restraint is the mark of quality

**Creative freedom within constraints:**

- Stay within Tailwind CSS + Next.js — no external animation libraries unless justified
- Use design tokens (`src/platform/theme/tokens.ts`) for all colors
- Respect accessibility (contrast ratios, reduced motion, focus indicators)
- Test at 6 viewports (320, 430, 768, 1024, 1280, 1920px)
- Beyond these constraints: **experiment freely.** Combine patterns, and invent a new one when none fits the need. Add subtle shadows, micro-animations, unexpected but effective layout choices. If the result is clean, intuitive, and beautiful, and meets the [alignment baseline](../ui-ux-design.md#symmetry-and-alignment) — ship it.

**When inventing something new:**

- Build it, screenshot it at all viewports, verify it works
- If it's good, add it to this library with a name, code snippet, and explanation of why it works
- The library grows through creative work, not through rules committees

## How to Use This Library

1. **Designer identifies a problem** (e.g., "hero text is hard to read on the image")
2. **Designer prescribes a pattern from this library** (e.g., "use the Frosted Glass Text Panel")
3. **Builder copies the snippet, adapts it to the component, and ships it**

The designer SHOULD reference patterns by name and include the specific snippet. The builder SHOULD NOT invent visual effects from scratch when a pattern exists here — but IS encouraged to combine, adapt, and extend patterns creatively.

**These snippets are templates, not copy-paste code.** Adapt them to the specific component, props, and context. All snippets follow the same standards as production code (see [Documentation Is Code](../development.md#documentation-is-code)).

## The library

| File                                          | Patterns                                                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Heroes and images](heroes-and-images.md)     | Anchored Hero, Frosted Glass Text Panel, Split Hero; gradient scrims, text shadow stack                                                                                |
| [Sections and cards](sections-and-cards.md)   | Background Alternation, Angled Section Divider, Fade Overlap; Stat Card, Feature Card; Gradient CTA with Texture, CTA with Background Image; responsive layout recipes |
| [Motion](motion.md)                           | Fade-In on Scroll, Staggered Card Reveal; Subtle Background Parallax, JS-Based Smooth Parallax                                                                         |
| [Backdrops and glass](backdrops-and-glass.md) | Glass Card, Glass Navigation Bar; Faded Photo Backdrop, Tinted Photo Strip; backdrop photo guide                                                                       |

When a new pattern is proven, add it to the file it fits (or a new file listed here), with a
name, the snippet, and why it works.

---

## Debugging Visual Issues

### Checklist: "Why Does This Section Look Wrong?"

1. **Is the text centered when it shouldn't be?** Check for `text-center` or `justify-center` on containers with multi-sentence text. Remove it — left-align the text and add a visual element to balance the layout.

2. **Is there too much empty space?** Check `min-h-[Xvh]` values. If the content doesn't fill the height, either reduce the min-height or anchor content to one edge (top or bottom) instead of centering.

3. **Are consecutive sections the same background color?** Check the background classes. Alternate between `bg-background` and `bg-surface`. Use `bg-primary` gradient for CTA sections to break the pattern.

4. **Is the content too narrow or too wide?** Check `max-w-*` values. Headings can be wider (`max-w-3xl`), body text should be narrower (`max-w-prose` or `max-w-lg`). Cards grids should use the full container width.

5. **Are cards missing visual differentiation?** Check if all cards look identical. Add icons, category colors, or image treatments to differentiate them.

6. **Is the hover state missing or too subtle?** Every interactive element needs a visible hover state. Use the `Card`'s `interactive` hover for cards (`hover:shadow-md motion-safe:hover:-translate-y-0.5 transition-all duration-200`), `hover:bg-primary-fill-hover` for buttons.

7. **Does the section have a clear eyebrow → heading → body → CTA hierarchy?** If not, add an eyebrow label (`text-xs font-bold uppercase tracking-widest text-primary`) and ensure the heading is significantly larger than the body text.

### Viewport Testing Quick Reference

| Viewport  | Width  | What to check                                                          |
| --------- | ------ | ---------------------------------------------------------------------- |
| Mobile S  | 320px  | Text wrapping, touch targets (44px min), no horizontal overflow        |
| Mobile L  | 430px  | Same as above, verify nothing breaks at slightly wider mobile          |
| Tablet    | 768px  | Grid columns transition, image aspect ratios, nav layout               |
| Tablet L  | 1024px | Desktop layout in place (starts at 960px, #545)                        |
| Desktop   | 1280px | Full layout, nothing feels too wide or too narrow                      |
| Desktop L | 1920px | Content centered, no ultra-wide stretching, max-width constraints work |

---

## Anti-Patterns to Flag

These are specific implementation mistakes the designer should catch and prescribe fixes for:

| Anti-Pattern        | What You See                                         | Fix                                                                     |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Centered void       | Text floating in the middle of a tall empty space    | Anchor to bottom or side, reduce height, or add visual elements         |
| Centered paragraph  | Multi-sentence text with `text-center`               | Remove `text-center`, add `max-w-prose`, left-align                     |
| Uniform cards       | All cards identical with no visual differentiation   | Add icons, images, or color accents per card                            |
| Consecutive same-bg | Two sections with same background color              | Alternate `bg-background`/`bg-surface`, or insert a colored divider     |
| Giant min-height    | `min-h-[80vh]` with 3 lines of content               | Reduce to `min-h-[60vh]` or use `py-24` instead                         |
| Missing scrim       | `text-on-image` on a bright image with no gradient   | Add `bg-gradient-to-t from-scrim/60` below text area                    |
| Template buttons    | Generic "Learn More" or "Get Started"                | Use specific action words: "See Upcoming Events", "Join the Discussion" |
| Orphan section      | A section with heading + one sentence + nothing else | Merge with adjacent section or add supporting content                   |
