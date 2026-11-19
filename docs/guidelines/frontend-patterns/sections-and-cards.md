# Frontend patterns: sections and cards

Part of the [frontend pattern library](README.md): section transitions, cards, calls to action and responsive layouts. Snippets are templates: adapt
them to the component, and hold them to [the same standards as production code](../development.md#documentation-is-code).

## Section Transition Patterns

### Pattern: Background Alternation

Sections must alternate between `bg-background` and `bg-surface` to create visual rhythm. Never use the same background on consecutive sections.

```text
Section 1 (Hero):     dark / full-bleed image
Section 2 (Content):  bg-background
Section 3 (Cards):    bg-surface
Section 4 (News):     bg-background
Section 5 (CTA):      bg-primary gradient
Section 6 (Footer):   dark
```

### Pattern: Angled Section Divider

A subtle angle between sections creates visual flow without hard horizontal lines.

```tsx
<section className="relative bg-surface py-16 md:py-24">
  {/* Angled top edge */}
  <div className="absolute inset-x-0 -top-8 h-16 -skew-y-1 bg-surface" />
  <div className="relative container">{/* Section content */}</div>
</section>
```

**How it works:** A skewed div extends above the section, creating a diagonal transition from the previous section. The `-top-8` positions it to overlap.

### Pattern: Fade Overlap

A gradient at the bottom of one section that fades into the next. Already used on the hero — extend this to other section boundaries.

<!-- prettier-ignore -->
```tsx
{/* At the bottom of any section */}
<div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
```

---

## Card Patterns

### Pattern: Stat Card (Icon + Number + Label)

For feature/stat strips. More visually engaging than text-only cards.

```tsx
<div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
  {stats.map((stat) => (
    <div
      key={stat.label}
      className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm"
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <stat.icon className="h-6 w-6 text-primary" />
      </div>
      <div className="text-2xl font-bold text-foreground">{stat.value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
    </div>
  ))}
</div>
```

**Why it works:** The icon gives each card visual identity. The colored icon container creates a focal point. Number + label is scannable in under a second.

### Pattern: Feature Card (Horizontal with Icon)

For content sections where each item has a heading and description.

```tsx
<div className="flex gap-4">
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
    <Icon className="h-5 w-5 text-primary" />
  </div>
  <div>
    <h3 className="font-semibold text-foreground">{title}</h3>
    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>
</div>
```

---

## CTA Section Patterns

### Pattern: Gradient CTA with Texture

More visually interesting than a flat gradient.

```tsx
<section
  className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/70 py-16 md:py-24"
  data-theme="dark"
>
  {/* Subtle texture overlay — uses Tailwind arbitrary values, no inline styles */}
  <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,var(--primary-foreground)_1px,transparent_0)] [background-size:24px_24px] opacity-10" />

  <div className="relative container">
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-bold text-primary-foreground md:text-4xl">
        Join Your Neighbors
      </h2>
      <p className="mt-4 text-lg text-primary-foreground/85">
        Whether you've lived here for years or just moved in, there's a place for you.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <a className="rounded-lg bg-primary-foreground px-6 py-3 font-semibold text-primary transition hover:bg-primary-foreground/90">
          Get Involved
        </a>
        <a className="rounded-lg border-2 border-primary-foreground/70 px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary-foreground/10">
          Contact Us
        </a>
      </div>
    </div>
  </div>
</section>
```

**The texture:** A dot grid pattern at 10% opacity adds visual interest without distracting. The `radial-gradient` trick creates a repeating dot pattern with pure CSS — no image file needed.

### Pattern: CTA with Background Image

For CTAs that want more visual impact than a solid color.

```tsx
<section className="relative overflow-hidden py-16 md:py-24">
  <div className="absolute inset-0">
    <Image src={bgUrl} alt="" fill className="object-cover" />
  </div>
  <div className="absolute inset-0 bg-primary/85" />
  <div className="relative container text-center text-primary-foreground">{/* CTA content */}</div>
</section>
```

**Key:** `bg-primary/85` overlays the brand color at 85% opacity over the image. The image adds texture without competing with the text.

---

## Responsive Layout Recipes

### Two-Column Content + Image

The most common section layout. Text left, visual right. Reverses on alternate sections.

<!-- prettier-ignore -->
```tsx
{/* Normal order */}
<div className="grid items-center gap-8 md:grid-cols-2 lg:gap-16">
  <div>{/* Text content */}</div>
  <div>{/* Image/visual */}</div>
</div>

{/* Reversed (image left, text right) — for alternating sections */}
<div className="grid items-center gap-8 md:grid-cols-2 lg:gap-16">
  <div className="order-2 md:order-1">{/* Image/visual */}</div>
  <div className="order-1 md:order-2">{/* Text content */}</div>
</div>
```

**Mobile:** Always text first, image second (regardless of desktop order). This is why `order-1`/`order-2` is used.

### Three-Column Card Grid

```tsx
<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
  {items.map((item) => (
    <Card key={item.id} {...item} />
  ))}
</div>
```

**Breakpoint behavior:** 1 column on mobile, 2 on tablet, 3 on desktop. Gap increases at `lg`.

### Four-Column Stat Grid

```tsx
<div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
  {stats.map((stat) => (
    <StatCard key={stat.label} {...stat} />
  ))}
</div>
```

**Breakpoint behavior:** 2x2 grid on mobile, 4-across on tablet+.
