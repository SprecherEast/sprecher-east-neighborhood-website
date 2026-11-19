# Frontend patterns: heroes and images

Part of the [frontend pattern library](README.md): hero layouts and keeping text readable on photos. Snippets are templates: adapt
them to the component, and hold them to [the same standards as production code](../development.md#documentation-is-code).

## Hero Patterns

These patterns are for the home page and landing pages. A post or event page is not a hero: it uses `PageHeader` with `variant="band"`, a short plain title band with the facts under it, and shows its picture whole in the article with `FeaturedImage`, never cropped behind the title (#1013).

### Pattern: Anchored Hero (Text Bottom-Left)

Instead of centering everything in a tall void, anchor content to the bottom-left. Creates visual weight and a natural reading entry point.

```tsx
<div className="relative -mt-[var(--header-height)] min-h-[var(--page-min-height)]">
  {/* Background image */}
  <div className="absolute inset-0">
    <Media fill imgClassName="object-cover" priority resource={media} />
  </div>

  {/* Gradient scrim — darkens bottom where text lives */}
  <div className="absolute inset-0 bg-gradient-to-t from-scrim/70 via-scrim/30 to-transparent" />

  {/* Content anchored to bottom-left */}
  <div className="relative z-10 container flex min-h-[var(--page-min-height)] items-end pb-16 md:pb-20">
    <div className="max-w-2xl">
      <h1 className="text-4xl leading-tight font-bold tracking-tight text-on-image md:text-5xl lg:text-6xl">
        Your Neighborhood, Your Community
      </h1>
      <p className="mt-4 max-w-lg text-lg leading-relaxed text-on-image/85 md:text-xl">
        Connecting residents on Madison's Far East Side since 2006.
      </p>
      <div className="mt-8 flex flex-wrap gap-4">
        <a className="rounded-lg bg-primary-fill px-6 py-3 font-semibold text-primary-foreground shadow-lg transition hover:-translate-y-0.5 hover:bg-primary-fill-hover hover:shadow-xl">
          Upcoming Events
        </a>
        <a className="rounded-lg border-2 border-on-image/70 px-6 py-3 font-semibold text-on-image transition hover:bg-on-image/10">
          Get Involved
        </a>
      </div>
    </div>
  </div>
</div>
```

**Why it works:** The eye enters at the bottom-left naturally. The gradient only darkens where text lives, keeping the top of the image vivid. Content has a clear anchor point instead of floating.

**Responsive behavior:** Text stack is left-aligned at all breakpoints. On mobile, `pb-16` gives breathing room above the fold line.

---

### Pattern: Horizon-Anchored Hero (the home hero)

Where the photo has a clear horizon, lay the text out from it instead of from the bottom of a tall band: the title in the sky just above the horizon, the description and the buttons just below it, the photo at the top and fading into the page. Do not copy it: it is `PageHero` (the high look), built from `hero-geometry` and `hero-fade` (`src/platform/theme/tailwind.css`), `heroPhotoVars` (`src/modules/site/domain/heroGeometry.ts`) and the `HERO_*` sizes (`layoutSizes.ts`).

- The upload's focal point height is the horizon: an editor sets it on the tree line in Admin, so a new photo needs no code.
- The photo box is never shorter than `--hero-photo-min`, so the title and the note fit above and below the horizon on a phone.
- The fade is eased (smoothstep), about 150 px, the last part of it under the next section; the blocks are drawn above the hero for that (`relative z-10` in `[slug]/page.tsx`).

---

### Pattern: Frosted Glass Text Panel

Place the hero's text on a frosted glass panel that sits on top of the image: the shared `GlassPanel` (#1278), which darkens itself, so its text is legible whatever the image holds. The title stays on the photo, as on the home hero.

```tsx
<div className="relative -mt-[var(--header-height)] min-h-[var(--page-min-height)]">
  {/* Background image — stays vivid */}
  <div className="absolute inset-0">
    <Media fill imgClassName="object-cover" priority resource={media} />
  </div>

  {/* Subtle overall scrim so the glass panel doesn't float in brightness */}
  <div className="absolute inset-0 bg-scrim/20" />

  {/* Title on the photo, description in the glass panel */}
  <div className="relative z-10 container flex min-h-[var(--page-min-height)] items-end pb-16 md:items-center md:pb-0">
    <div className="w-full max-w-xl">
      <h1 className="text-3xl leading-tight font-bold tracking-tight text-on-image text-shadow-photo md:text-4xl lg:text-5xl">
        Your Neighborhood, Your Community
      </h1>
      <GlassPanel className="mt-3">
        <p className="text-base leading-relaxed text-on-image/90 md:text-lg">
          Connecting residents on Madison's Far East Side since 2006.
        </p>
      </GlassPanel>
      <div className="mt-8 flex flex-wrap gap-4">
        <a className="rounded-lg bg-primary-fill px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary-fill-hover">
          Upcoming Events
        </a>
        <a className="rounded-lg border border-on-image/50 px-6 py-3 font-semibold text-on-image transition hover:bg-on-image/10">
          Get Involved
        </a>
      </div>
    </div>
  </div>
</div>
```

**Key CSS:** none to write: the panel's blur, tint, border and darkening layer live in `GlassPanel`.

**Browser support:** `backdrop-filter` is supported in all modern browsers. Safari 9–17 requires the `-webkit-backdrop-filter` prefix; Safari 18+ supports the unprefixed property. For maximum compatibility, include both in `globals.css` if targeting older Safari versions.

**Responsive:** Panel is full-width on mobile (anchored to bottom with `items-end`), centered on desktop (`md:items-center`).

---

### Pattern: Split Hero (Text Left, Image Right)

For heroes without a full-bleed background image. Text occupies 50-60% of the width, image fills the rest.

```tsx
<div className="container py-16 md:py-24">
  <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
    {/* Text side — always left */}
    <div>
      <span className="text-xs font-bold tracking-widest text-primary uppercase">
        Sprecher East
      </span>
      <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight text-foreground md:text-5xl">
        Your Neighborhood, Your Community
      </h1>
      <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
        A grassroots neighborhood initiative connecting residents of Meadowlands, Door Creek, and
        Reston Heights since 2006.
      </p>
      <div className="mt-8 flex flex-wrap gap-4">
        <a className="rounded-lg bg-primary-fill px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary-fill-hover">
          Upcoming Events
        </a>
        <a className="rounded-lg border border-primary px-6 py-3 font-semibold text-primary transition hover:bg-primary/10">
          Get Involved
        </a>
      </div>
    </div>

    {/* Image side */}
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-xl">
      <Media fill imgClassName="object-cover" resource={media} />
    </div>
  </div>
</div>
```

**Why it works:** Asymmetric layout with clear visual weight distribution. Left side has the reading content, right side has the visual. The eye naturally scans left-to-right.

**Responsive:** Stacks vertically on mobile (image below text). On desktop, side-by-side.

---

## Text Readability on Images

### Pattern: Gradient Scrim (Bottom-Up)

When text sits at the bottom of an image. Darkens only the bottom portion.

```css
/* Bottom-anchored text */
.scrim-bottom {
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--scrim) 70%, transparent) 0%,
    color-mix(in srgb, var(--scrim) 30%, transparent) 40%,
    transparent 70%
  );
}
```

Tailwind equivalent:

```css
bg-gradient-to-t from-scrim/70 via-scrim/30 to-transparent
```

### Pattern: Gradient Scrim (Left Side)

When text sits on the left with image visible on the right.

```css
bg-gradient-to-r from-scrim/70 via-scrim/40 to-transparent
```

### Pattern: Text Shadow Stack

For text directly on images without a scrim. Use multiple shadows for a soft halo effect.

```css
.hero-text-readable {
  text-shadow:
    0 1px 3px color-mix(in srgb, var(--scrim) 60%, transparent),
    0 4px 12px color-mix(in srgb, var(--scrim) 40%, transparent),
    0 8px 24px color-mix(in srgb, var(--scrim) 20%, transparent);
}
```

In Tailwind (using arbitrary `text-shadow` value):

```css
[text-shadow:0_1px_3px_color-mix(in_srgb,var(--scrim)_60%,transparent),0_4px_12px_color-mix(in_srgb,var(--scrim)_40%,transparent),0_8px_24px_color-mix(in_srgb,var(--scrim)_20%,transparent)]
```

Or add to `globals.css`:

```css
.hero-text-readable {
  text-shadow:
    0 1px 3px color-mix(in srgb, var(--scrim) 60%, transparent),
    0 4px 12px color-mix(in srgb, var(--scrim) 40%, transparent),
    0 8px 24px color-mix(in srgb, var(--scrim) 20%, transparent);
}
```
