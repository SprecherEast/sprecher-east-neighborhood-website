---
name: write-code
description: How to write, move or refactor code in this repo so it stays modular and easy to read — where it goes (module and layer), reusing what exists, Payload and established libraries before custom code, the dependency rules, tests first, and small files. Use before writing or changing any code under src/, and when reviewing code.
---

# Write code the Sprecher East way

This is the owner's way of building the site, for every contributor, human or agent. The details
live in [`docs/architecture/`](../../../docs/architecture/README.md); this skill is the short path
through them. Read a reference file below only when the step needs it.

## What the owner asked for

Summary of the owner's direction (2026-10-20 and 2026-10-21, in the Claude Code sessions that
planned #127 and this skill):

- Follow domain-driven design and bounded contexts, and avoid anti-patterns such as modules
  referencing other modules.
- Make it easy to plug in different themes and CMS systems, with business logic and core code kept
  separate.
- Don't reinvent the wheel or overengineer.
- Keep things manageable, so a person can understand the site's structure from its folders alone.
- From the epics built on his requests (#127, #163): files under 250 lines, each rule
  and component written and tested once and reused, shared components instead of plain HTML
  elements.

Summary of the owner's direction (2026-10-22, Claude chat, #262): check native configuration and
features first, then an official plugin, then an open-source plugin. Write code only when none of
those exists.

## 1. Find what exists first

Before writing anything, search for it: this module, then `src/platform/`. Then go down the
ladder: native Payload, Next.js and React features and config, official plugins, well-established
free open-source plugins, and only then our own code.
Record what each step found on the issue before writing custom code. How:
[`references/reuse.md`](references/reuse.md).

Read what the knowledge layer says about it too: the module's line in
[`docs/knowledge/index.md`](../../../docs/knowledge/index.md) and its note, and the generated page
in `docs/reference/` of any content type you touch. Not the whole module.

## 2. Put it in the right place

```text
src/platform/          1. shared core: lib (pure helpers), ui (primitives with variants),
                          theme (token contract), payload (roles, fields), email, seo, richtext
src/themes/default/    2. the look: token values only
src/modules/<area>/    3. one business area each: events, news, contact, accounts, directory, site
  domain/ use-cases/   4. inside a module: rules and use cases in plain TypeScript,
  data/ cms/ ui/          adapters at the edges, components last; entry files in front
src/app/               routes and composition only: thin pages that call modules
payload.config.ts      CMS composition: registers each module's cms.ts
```

The full "where does it go?" table is in the
[architecture map](../../../docs/architecture/README.md#where-does-it-go). Module skeleton, entry
files, a new feature, a new module: [`references/placement.md`](references/placement.md).

## 3. Keep the dependencies pointing one way

Lint fails on the first four ([`eslint.boundaries.config.mjs`](../../../eslint.boundaries.config.mjs),
#137). Check `overrideAccess`, DTOs, `server-only` and colors yourself; #146 adds a color check
([rules](../../../docs/architecture/README.md#dependency-rules)):

- **Inward only:** `ui/` → `use-cases/` → `domain/`; `data/` and `cms/` → `domain/`. The domain
  imports no framework.
- **No module imports another module.** Two modules meet only where they are composed: a page, a
  layout or the block registry in `src/app/`, or `payload.config.ts` ([0008](../../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md)).
- **Entry files only:** code outside a module imports its `index.ts`, `server.ts`, `actions.ts` or
  `cms.ts`, never its inner folders. `src/platform/` imports no module.
- **Payload at the edges:** runtime Payload imports only in `data/`, `cms/`, `src/platform/` and
  `payload.config.ts`. Every Local API call sets `overrideAccess`. Use cases return the module's
  own types, not Payload documents.
- **Server code stays on the server:** `data/`, `use-cases/` and `server.ts` start with
  `import 'server-only'`. Client components get plain data as props.
- **No colors in components:** semantic token classes only, so a new theme changes no component.

## 4. Write the test first

For a rule, a guard or a mapper, write the failing test next to the file, then the code. Don't
test Payload, Next.js or styling. How: [`references/tests.md`](references/tests.md).

## 5. Keep it small and plain

- One responsibility per file and function; at most 250 lines per file, functions under about 50.
- Names follow the [conventions](../../../docs/architecture/conventions.md) and the
  [glossary](../../../docs/architecture/glossary.md), so the folder tree reads like the site.
- No abstraction before it pays: an interface only for an outside service, a second
  implementation, or a test double ([conventions](../../../docs/architecture/conventions.md#interfaces-and-adapters)).
- A component takes props for its variants (`cva`) instead of being copied; a second use moves
  it to `src/platform/ui/`.
- Use the shared primitives (`Button`, `Field`, `Form`, `Link`, `Media`), not raw `<button>`,
  `<input>` or `<img>`.

## Expert guidance for React and Next.js

The owner asked for established engineering practice over guesswork (2026-10-26, #424). For React
and Next.js code, also follow Vercel's official skills, vendored in this repo:

- [`vercel-react-best-practices`](../vercel-react-best-practices/SKILL.md): data fetching, bundle
  size, server components and re-renders. Apply the CRITICAL and HIGH rules to every change.
- [`vercel-composition-patterns`](../vercel-composition-patterns/SKILL.md): component APIs.
  Use it for every shared component: explicit variants and compound parts, not boolean props.
- Next.js itself: the bundled docs in `node_modules/next/dist/docs/` for the version we run.

This repo's rules come first where they differ, and a rule that needs a new package goes through
the [package rules](../../../docs/guidelines/security.md#before-adding-any-new-package).

## 6. Before you hand it over

```bash
npx tsc --noEmit && npm run lint && npm test && npm run knip
```

**Documentation follows behavior** ([0019](../../../docs/architecture/decisions/0019-knowledge-layer.md)
§6). If what a visitor, an editor or an agent gets changed (a screen, a message, a field, access, a
hook, a route, an email, a job, a limit), update the note that describes it in this PR: the one
`docs/knowledge/map.json` names for the path, in the section the
[template](../../../docs/knowledge/note-template.md) names, or the generated reference. A path the
map doesn't list: the doc that describes it (a guideline, the setup notes, a skill). A module with
no note yet needs none. If a content type changed, run `npm run docs:generate` (routes and
components once #718 lands). If behavior didn't change, the PR says `Behavior change: none` and why.

Fix new lint warnings in the files you touched, then run [`self-review`](../self-review/SKILL.md)
(and [`visual-design-review`](../visual-design-review/SKILL.md) when the page looks different).
