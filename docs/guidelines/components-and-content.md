# Reusable Components and Content Quality

Patterns for using existing components and maintaining content quality standards.

## Before Creating Components

1. Check `src/platform/ui/` and `src/platform/richtext/` first — most UI needs are already covered
2. Prefer Payload layout builder blocks (configs in `src/modules/site/cms/`, components in `src/modules/site/ui/`) over custom page components for content pages
3. Use the UI kit's primitives from `src/platform/ui/` for generic UI (`Button`, `Link`, `Field`, `Form`, etc.)

## Key Reusable Components

The full list of shared components, with their variants and props, is
[`docs/ui/component-set.md`](../ui/component-set.md), and the code is in `src/platform/ui/`. This
table names only the ones used most.

| Component  | Path                                 | Usage                                                                                    |
| ---------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| LinkButton | `src/platform/ui/CMSLink.tsx`        | A resolved CMS link (`ResolvedLink`) as a `Button` in the look the editor chose          |
| Media      | `src/platform/ui/Media.tsx`          | Image/video rendering with Payload media docs                                            |
| RichText   | `src/platform/richtext/RichText.tsx` | Renders Lexical rich text content                                                        |
| PostGrid   | `src/modules/news/ui/PostGrid.tsx`   | Grid display of posts with cards                                                         |
| Card       | `src/platform/ui/Card.tsx`           | The one card: `elevated`, `outline`, `muted`, `tinted`; parts; `CardGrid` lays cards out |
| Button     | `src/platform/ui/Button.tsx`         | The one button, `cva` variants (`primary`, `secondary`, `accent`, `ghost`, `inverse`, …) |
| JsonLd     | `src/platform/ui/JsonLd.tsx`         | Safe JSON-LD structured data (escapes XSS). Always use this.                             |

## Nav Links

When creating navigation links (header, footer, CTAs):

- Prefer `type: 'reference'` with `reference: { relationTo: 'pages', value: pageId }` for internal CMS pages
- Use `type: 'custom'` with `url: '/path'` only for non-CMS routes (e.g., `/events`, `/posts`, `/faq`)
- Reference links auto-update if the page slug changes; custom URLs break silently

## Content Quality

- Brand name is always "Sprecher East" — never "SENA", "SE", or abbreviations
- Always be transparent about AI assistance — this is an unofficial, AI-assisted initiative
- No real PII in source code or seed data — use `@example.com` for emails, placeholder names for board positions
- Content tone: friendly, direct, community-focused. Not corporate, not bureaucratic.

## Seed Data Rules

- **No weak passwords**: Use `process.env.SEED_PASSWORD || crypto.randomUUID()` for seed user passwords
- **No real email addresses**: All seed emails use `@example.com` domain
- **Set `_status: 'published'`**: Required for all draft-enabled collections in seed data
- **Use `context: { disableRevalidate: true }`**: Prevents revalidation errors during seeding
- **Meta titles are page names only**: e.g., `'Home'`, `'About'`, `'Contact'` — never include brand name (layout template adds it)

## Form Components

All forms must use the UI kit's primitives — never raw HTML `<input>`, `<label>`, or `<button>` elements:

- **Field**: `src/platform/ui/Field.client.tsx` — the label, required mark, hint and error around one control (`Field.Input`, `Field.TextArea`, `Field.Select`, `Field.Checkbox`), which it gives its id, `aria-describedby` and `aria-invalid`
- **Form**: `src/platform/ui/Form.client.tsx` — react-hook-form with a Zod schema, the fields grid and the fixed success or error message; for forms that submit data. A plain search box can use a `<form>` with `Field`
- **Button**: `src/platform/ui/Button.tsx` — CVA variants (`primary`, `secondary`, `ghost`, etc.)

For feedback messages (errors, success), use design tokens — never hardcoded Tailwind color classes. Always include ARIA live regions so screen readers announce state changes:

```tsx
// Error — role="alert" + aria-live="assertive" for immediate announcement
<div role="alert" aria-live="assertive" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">

// Success — role="status" + aria-live="polite" for non-urgent announcement
<div role="status" aria-live="polite" className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
```

## Icons

Use `lucide-react` for all icons. Never write inline SVG. The package is already installed and used throughout the codebase.

```tsx
import { Menu, X, Search } from 'lucide-react'
```

## Form UX

- **Clear stale feedback on input change**: After a form submission shows an error or success message, dismiss it as soon as the user edits any field. Stale messages mislead users into thinking their new input is invalid.
- **Client-side hooks in persistent layouts must re-sync on navigation**: If a client hook (like auth state) is used in a layout component that persists across route changes, it must re-fetch when the route changes — not just on initial mount. Use `pathname` as a dependency.

## Code Hygiene

- Remove unused parameters from types and function signatures — don't leave dead code
- Type component props with plain types (the module's own types, `ImageRef`, `RichTextValue`), never `@/payload-types`: a mapper in the module's `data/` converts CMS data ([decision 0013](../architecture/decisions/0013-cms-content-through-mappers.md)). Blocks and heroes not yet moved still use the generated types (regenerated automatically only under `next dev`; after a schema change run `npm run generate:types` and commit the result)
- Type seed data returns with `RequiredDataFromCollectionSlug<'slug'>` for compile-time safety
- Import types with `import type` to avoid bundling runtime code

## Messages

What a resident reads after an action (sent, failed, expired) lives in the catalog,
`src/platform/lib/messages/` ([decision 0017](../architecture/decisions/0017-one-message-catalog.md)),
not inline. Write whole sentences in the [brand voice](brand-voice.md), short enough for a phone, with `{blanks}` for
anything that varies. Never type a time: use `formatDuration()` on the real setting. The owner's
rule (2026-11-01, quoted on #551): messages sound like a human who understands this neighborhood.
