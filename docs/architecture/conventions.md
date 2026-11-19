# Conventions

Rules that keep the code predictable. When code and this page disagree, fix one of them in the same
PR. Where things go is in the [architecture map](README.md).

## Naming

| Thing                    | Convention                                         | Examples                            |
| ------------------------ | -------------------------------------------------- | ----------------------------------- |
| Module and layer folders | lowercase, kebab-case                              | `src/modules/events/data/`          |
| React component file     | PascalCase, named after its one exported component | `EventCard.tsx`                     |
| Client component file    | `.client.tsx` suffix, starts with `'use client'`   | `EventsFeed.client.tsx`             |
| Other TypeScript file    | camelCase, named after what it holds               | `categories.ts`, `scope.ts`         |
| Test file                | same name plus `.test.ts`, next to the file        | `scope.test.ts`                     |
| Type or interface        | PascalCase noun, no `I` prefix                     | `EventSummary`, `HumanVerifier`     |
| Constant value           | UPPER_SNAKE_CASE                                   | `UPCOMING_EVENTS_PAGE_SIZE`         |
| Fixed list of options    | `as const` array plus a derived union type         | `EVENT_CATEGORIES`, `EventCategory` |

### Function names say what they do

| Prefix                | Meaning                                                     | Example                      |
| --------------------- | ----------------------------------------------------------- | ---------------------------- |
| `find…`               | Database query that returns a list or a page (may be empty) | `findEventPage(scope, page)` |
| `get…`                | One item by key, or `null`                                  | `getEventBySlug(slug)`       |
| `require…`            | Like `get…`, but throws or redirects when missing           | `requireUser()`              |
| `list…`               | A light list of keys for routing or sitemaps                | `listEventSlugs()`           |
| `is…`, `has…`, `can…` | Returns a boolean                                           | `isEventScope(value)`        |
| `parse…`              | Untrusted input to a typed value, or `null` when invalid    | `parsePageNumber(value)`     |
| `check…`              | Untrusted input to a named verdict (`'ok'` or what's wrong) | `checkSubmissionSize(rows)`  |
| `to…`                 | Converts one shape into another                             | `toEventSummary(doc)`        |
| `format…`             | Builds text for display                                     | `formatDateShort(timestamp)` |

### Types that cross a boundary

Data functions return the module's own types, not Payload documents:

- `…Summary`: what a list or card needs (`EventSummary`).
- `…Detail`: what a detail page needs (`EventDetail`).

A `to…` mapper in `data/` builds them from Payload documents. When generated Payload types
(`@/payload-types`) may appear outside `data/` and `cms/` is set by rule 8 in the
[README](README.md#dependency-rules), with its exceptions.

## Entry files

- `index.ts` exports types and pure rules from `domain/`, nothing else. Any code may import it:
  the proxy (`src/proxy.ts`), client components and scripts get no React, Payload or server-only
  code with it.
- `server.ts` starts with `import 'server-only'` and re-exports the module's use cases (from
  `use-cases/`), its plain reads (straight from `data/`, #521) and the components pages render (from `ui/`).
- `actions.ts` starts with `'use server'` and exports server actions; each one validates its
  input and calls a use case or a plain `data/` read.
- `cms.ts` exports the area's collection and global configs, blocks and plugin options for
  `payload.config.ts`. Nothing it reaches may be server-only, because the Payload CLI loads it
  outside Next.js.
- Nothing outside a module imports from its inner folders, and nothing inside it imports its own
  entry files, except that `ui/` may import its module's `actions.ts` (server actions must live in a
  `'use server'` file). Any component that imports an `actions.ts` is exported from `server.ts`. If
  something is missing from an entry file, add it there.

## Interfaces and adapters

Add an interface only where it pays:

- the code talks to an outside service (Cloudflare Turnstile, Mailgun, a city calendar feed), or
- there are, or soon will be, two implementations, or
- a test needs to replace a real dependency.

Name the interface after the capability and the adapter after the provider: `HumanVerifier`,
`TurnstileVerifier`. The interface goes in the module's `domain/`; the adapter goes in the layer
that calls it. A Payload hook's adapter sits in `cms/`, because the Payload CLI loads hooks
outside Next.js, where `server-only` code can't run. Once two modules use them, both move to
`platform/`: the interface to `lib/`, the adapter to a folder of its own (`HumanVerifier` and
`platform/turnstile/`, used by `contact` and `accounts`).

Don't wrap Payload collections in repository interfaces; the typed Local API plus a module's
`data/` functions is the boundary ([decision 0002](decisions/0002-no-repository-layer.md)).
Values that change between environments come from env vars read in one place, never literals in
code.

## One rule, one place

Every rule, list and query exists once and is imported everywhere it's needed. Before writing
logic, search for it. When the same logic appears a second time, move it to the right shared place
(the module's `domain/` or `src/platform/`), test it there, and replace the copy in the same PR.

## Size

- Files: at most 250 lines, blank lines and comments excluded (ESLint `max-lines`, lowered from 300
  in #137). Data lists (for example a country list) and generated files are exempt.
- Functions: aim for under 50 lines. A long component usually hides a smaller component.

## Comments

- Explain _why_, not _what_. A comment that repeats the code goes stale.
- Exported functions get a one-line JSDoc that says what they return and any surprise (time zone,
  access rules, what `null` means).
- Link the issue when a comment records a decision or a workaround (`#118`).

## Errors and messages

- Visitors see short, fixed, friendly messages. Sign-in and password flows never reveal whether an
  account exists.
- Server logs say what failed and why, never passwords, tokens or what a visitor typed.
- Payload hooks reject with `APIError(message, status, null, true)`.

## Tests

- Unit-test every `domain/` rule, every guard, and every `to…` mapper.
- Don't test Payload, Next.js or styling.
- Tests are deterministic: fixed dates (`vi.useFakeTimers`), no network (`vi.stubGlobal('fetch', …)`),
  no database.
- `describe` names the function; each `it` reads as a sentence about behavior:
  `it('turns over at midnight in the site timezone')`.
- Run `npm test`. CI runs the same suite on every PR that changes code.
