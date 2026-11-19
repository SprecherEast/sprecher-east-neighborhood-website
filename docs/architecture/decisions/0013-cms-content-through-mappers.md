# 0013: Blocks and heroes take plain props, mapped from the CMS

- **Date:** 2026-10-26
- **Status:** Accepted. Replaces the last sentence of
  [rule 8](../README.md#dependency-rules) ("code that renders CMS content as authored … takes the
  generated types").
- **Issues and PRs:** #426, #163

## Context

Rule 8 already keeps raw Payload documents out of use cases: `data/` maps them to the module's own
types (`EventSummary`, `EventDetail`, [0002](0002-no-repository-layer.md)). It made one exception.
Page-builder blocks, heroes, `RichText` and `Media` took the generated Payload types, because the
CMS sets their shape.

The shared component set for epic #163 ([`docs/ui/component-set.md`](../../ui/component-set.md))
gives every component plain typed props instead, as the owner's plan on #163 (2026-10-20) asks:
"Components receive plain typed data and never import Payload directly." That clashed with the
exception, so the set listed it as an open choice. The owner asked agents to settle it from
established practice: "We'd like the best engineering practices put into place, making this
website modular, plug and play with future things, scalable" (Claude Code session, 2026-10-26,
quoted on #426).

What established practice says:

- The anti-corruption layer pattern puts a translation layer between a system and an outside
  model, so the outside model's shape doesn't spread into the system's own code. Payload's
  generated types are that outside model: a field renamed in the admin changes them.
- Design systems build components against their own props, so the same component renders from
  the CMS, a test, a Storybook story or another module, with no CMS document around it.
- Next.js passes props from server to client components as serialisable data. A small, explicit
  prop shape sends less to the browser than a whole document with its relations.

## Decision

1. **Blocks and heroes take plain typed props.** The props type (`ContentBlockProps`,
   `PageHeroProps`) lives in the owning module's `domain/`, so the component in `ui/` and the
   mapper in `data/` can both import it ([rule 1](../README.md#dependency-rules)). Like every
   other component, the block never imports `@/payload-types`. `domain/` may import only
   `platform/lib/`, so the value types a props type uses live there: `ImageRef` and
   `RichTextValue` already do, and the `ResolvedLink` type moves from
   `src/platform/payload/resolveLink.ts` to `src/platform/lib/content.ts` with the first block
   that carries a link (`resolveLink()` itself stays in `platform/payload/`).
2. **One mapper per block or hero**, `to…Props`, in the owning module's `data/mappers.ts` (next to
   the existing document mappers), turns the stored block into those props. Images go through
   `toImageRef()` (`src/platform/payload/imageRef.ts`), links through `resolveLink()`, and rich
   text stays `RichTextValue`.
3. **Where the mapping runs.** The use case that loads a page maps the blocks and heroes its own
   module owns, so `getPageBySlug` returns `site`'s blocks and hero as plain props. A block another
   module owns (the form from `contact`, the post list from `news`) can't be mapped by `site`
   ([rule 3](../README.md#dependency-rules), [0008](0008-compose-modules-at-the-app-level.md)): the
   page's layout carries it as stored, and the block registry in `app/` maps it through a function
   the owning module exports from `server.ts` (a use case that calls its mapper). A block from
   `platform/` (the media block) is mapped by a function next to it in `platform/`.
4. **Typing while blocks move.** The page's layout type is a union with one member per block
   type: the plain props for a `site` block that has moved, and the stored (generated) block type
   for one that hasn't yet or that another module owns, which the registry maps (point 3). `PageBlockComponents` is keyed by `blockType` over that union, so `tsc` still
   fails when a block type has no component, and each block moves on its own.
5. **`RichText` and `Media` keep their value types.** `RichTextValue` (Lexical's editor state) and
   `ImageRef` (`src/platform/lib/content.ts`) are the platform's names for those values. They are
   the contract; what they alias can change in one place.
6. **Moving is gradual.** A block or hero moves to plain props when its #163 component is built or
   it is next changed. Until then it keeps the generated types. New blocks start with plain props.

## Consequences

- Components can be tested, previewed and reused with plain data, and a CMS schema change breaks
  one mapper, which `tsc` points at, not every component that renders the field.
- Each block gets a mapper and a props type to maintain: a few lines each, worth it for the
  isolation.
- Rule 8 has one fewer exception, and the component set no longer needs the owner's choice.

## Links

- Microsoft, anti-corruption layer pattern
  (https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer)
- Next.js, passing data from server to client components
  (https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [`docs/ui/component-set.md`](../../ui/component-set.md), rules every component follows
