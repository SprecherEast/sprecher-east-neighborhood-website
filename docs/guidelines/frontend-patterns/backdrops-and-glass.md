# Frontend patterns: backdrops and glass

Part of the [frontend pattern library](README.md): frosted glass, photo backdrops, and which placeholder photo goes where. Snippets are templates: adapt
them to the component, and hold them to [the same standards as production code](../development.md#documentation-is-code).

## Glassmorphism Components

### Pattern: Glass Card

A frosted glass card for overlays, modals, or floating content.

```tsx
<div className="rounded-2xl border border-on-image/20 bg-on-image/10 p-6 shadow-xl backdrop-blur-md">
  {/* Card content */}
</div>
```

**Dark variant (on dark backgrounds):**

```tsx
<div className="rounded-2xl border border-on-image/10 bg-scrim/20 p-6 shadow-xl backdrop-blur-md">
  {/* Card content */}
</div>
```

**Colored variant (brand tint):**

```tsx
<div className="rounded-2xl border border-primary/20 bg-primary/10 p-6 shadow-xl backdrop-blur-md">
  {/* Card content */}
</div>
```

### Pattern: Glass Navigation Bar

Frosted glass header that shows content scrolling beneath.

```tsx
<header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
  <nav className="container flex h-[var(--header-height)] items-center justify-between">
    {/* Nav content */}
  </nav>
</header>
```

**Key:** `bg-background/80` (80% opacity of the background token) + `backdrop-blur-lg` (16px blur). The border adds a subtle edge.

---

## Section Backdrop Patterns

### Pattern: Faded Photo Backdrop

A section background photo at very low opacity — adds warmth and context without competing with content. The photo is felt, not seen.

```tsx
<section className="relative overflow-hidden bg-surface py-16 md:py-24">
  {/* Backdrop photo — extremely subtle */}
  <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
    <Image src={backdropUrl} alt="" fill className="object-cover" />
  </div>
  {/* Optional: tinted overlay to blend photo into section bg color */}
  <div className="pointer-events-none absolute inset-0 bg-surface/60" />

  <div className="relative z-10 container">{/* Section content */}</div>
</section>
```

**Key:** `opacity-[0.06]` (6%) makes the image almost subliminal — you feel texture without consciously seeing the photo. The `bg-surface/60` overlay tints the image to match the section color so it doesn't clash.

**Tuning:** `0.04` = barely visible ghost, `0.06` = subtle texture, `0.10` = clearly visible backdrop, `0.15` = prominent (too much for most sections). Start at `0.06`.

**Dark mode:** Use `opacity-[0.04]` on dark backgrounds — dark sections need less image opacity to feel textured.

### Pattern: Tinted Photo Strip

A full-bleed section where a photo is visible but tinted with the brand color. More prominent than a backdrop — used for section dividers or visual breaks.

```tsx
<section className="relative overflow-hidden py-16 md:py-24">
  <div className="absolute inset-0">
    <Image src={photoUrl} alt="" fill className="object-cover" />
  </div>
  {/* Brand tint — photo visible but color-matched to the site */}
  <div className="absolute inset-0 bg-primary/80" />
  <div className="relative z-10 container text-on-image">{/* Content */}</div>
</section>
```

**Variants:**

- `bg-primary/80` — strong brand tint, text is white
- `bg-background/85` — soft wash, text stays dark (foreground)
- `bg-gradient-to-r from-primary/90 to-primary/70` — gradient tint reveals more image on one side

---

## Section Backdrop Photos

The site ships no stock backdrop photos. A section backdrop is a real neighborhood photo uploaded to
the media library, never a file in `public/images/`. Photos must be level and well presented.

**Photo treatment rules:**

- Use `object-cover` so photos fill their container without distortion
- Export at 1920px wide, quality 80: backdrops are shown at low opacity and don't need sharpness
- All backdrop images get `alt=""` (decorative, not informational)
