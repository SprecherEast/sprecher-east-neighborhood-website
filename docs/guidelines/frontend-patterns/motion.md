# Frontend patterns: motion

Part of the [frontend pattern library](README.md): scroll reveals and parallax. Snippets are templates: adapt
them to the component, and hold them to [the same standards as production code](../development.md#documentation-is-code).

## Scroll Animations

### Pattern: Fade-In on Scroll

Using CSS-only `@starting-style` (modern browsers) or Intersection Observer for broader support.

**CSS approach (add to globals.css):**

```css
.animate-on-scroll {
  opacity: 0;
  transform: translateY(1.5rem);
  transition:
    opacity 0.6s ease-out,
    transform 0.6s ease-out;
}

.animate-on-scroll.is-visible {
  opacity: 1;
  transform: translateY(0);
}
```

**React hook (client component):**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'

export function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}
```

**Usage:**

```tsx
function Section() {
  const { ref, isVisible } = useScrollReveal()
  return (
    <div ref={ref} className={`animate-on-scroll ${isVisible ? 'is-visible' : ''}`}>
      {/* Content fades in when scrolled into view */}
    </div>
  )
}
```

**Reduced motion:** Always respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-on-scroll {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

### Pattern: Staggered Card Reveal

Cards in a grid appear one after another with a slight delay. Each card is wrapped in a dedicated component to respect React's Rules of Hooks.

<!-- prettier-ignore -->
```tsx
function RevealCard({ card, index }: { card: CardProps; index: number }) {
  const { ref, isVisible } = useScrollReveal()
  const delayClass = ['delay-0', 'delay-100', 'delay-200', 'delay-300', 'delay-[400ms]'][
    Math.min(index, 4)
  ]
  return (
    <div ref={ref} className={`animate-on-scroll ${delayClass} ${isVisible ? 'is-visible' : ''}`}>
      <Card {...card} />
    </div>
  )
}

{/* Usage */}
{cards.map((card, i) => (
  <RevealCard key={card.id} card={card} index={i} />
))}
```

**Rule:** Max delay of 400ms (4 cards). Beyond that, everything after the 4th card should appear at the same time. Uses Tailwind delay utilities instead of inline styles.

---

## Parallax Patterns

### Pattern: Subtle Background Parallax

The background image moves slower than the scroll, creating depth. Two approaches: CSS `background-attachment: fixed` for simple parallax, or an oversized `<Media />` container for next/image compatibility.

**Approach A: CSS parallax with `background-image`** — add to `globals.css`:

```css
.parallax-bg {
  background-attachment: fixed;
  background-size: cover;
  background-position: center;
}

/* iOS Safari doesn't support background-attachment: fixed — fall back to static */
@media (hover: none) and (pointer: coarse) {
  .parallax-bg {
    background-attachment: scroll;
  }
}
```

```tsx
<section className="relative overflow-hidden py-24">
  {/* CSS parallax — uses background-image via inline style (acceptable here since the URL is dynamic) */}
  <div className="parallax-bg absolute inset-0" style={{ backgroundImage: `url(${imageUrl})` }} />
  <div className="absolute inset-0 bg-scrim/40" />
  <div className="relative z-10 container text-on-image">{/* Content */}</div>
</section>
```

**Approach B: Oversized container with `<Media />`** — works with next/image optimization:

```tsx
<section className="relative overflow-hidden py-24">
  {/* Oversized container creates parallax-like depth on scroll */}
  <div className="absolute inset-0 -top-[20%] -bottom-[20%]">
    <Media fill imgClassName="object-cover" resource={media} />
  </div>
  <div className="absolute inset-0 bg-scrim/40" />
  <div className="relative z-10 container text-on-image">{/* Content */}</div>
</section>
```

**When to use which:** Approach A gives true parallax but bypasses next/image optimization. Approach B uses optimized images but relies on the oversized container (`-top-[20%] -bottom-[20%]`) to prevent gaps — it's not true parallax but creates a similar depth feel. For full parallax with optimized images, use the JS-Based Smooth Parallax pattern below.

**Mobile note:** `background-attachment: fixed` doesn't work on iOS Safari. The `@media (hover: none) and (pointer: coarse)` query targets touch devices and falls back to static — which is fine for small screens.

### Pattern: JS-Based Smooth Parallax

For more control over parallax speed and direction. Client component. Uses `requestAnimationFrame` to avoid scroll jank.

```tsx
'use client'
import { useEffect, useRef } from 'react'
import Image from 'next/image'

export function ParallaxImage({ src, speed = 0.3 }: { src: string; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ticking = false

    function update() {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const offset = rect.top * speed
      el.style.transform = `translateY(${offset}px)`
      ticking = false
    }

    function handleScroll() {
      if (!ticking) {
        requestAnimationFrame(update)
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [speed])

  return (
    <div className="absolute inset-0 -top-[15%] -bottom-[15%] overflow-hidden">
      <div ref={ref} className="h-full w-full">
        <Image src={src} alt="" fill className="object-cover" />
      </div>
    </div>
  )
}
```

**Speed values:** `0.2` = subtle, `0.3` = noticeable, `0.5` = dramatic. Default to `0.3`.
