---
name: 'Shared helpers'
type: platform-area
summary: 'dates, money, page numbers, emails, chart rules, bill math.'
aliases: ['lib', 'bill share', 'message catalog']
relationships: []
---

# Shared helpers

The pure, framework-free helpers every module and the UI kit use (`src/platform/lib/`). Nothing here calls Payload, React or the network (types only, and one pure string helper from Payload's shared entry), so the browser, a module's `domain/` and the proxy may all import it. It holds no CMS content; it holds the rules behind the numbers, dates, messages and limits the other notes name. Content shapes such as `RichTextValue` and `ImageRef` are types only (`content.ts`).

## How the pieces link

- **One surface:** `index.ts` is what a module's `domain/` may import; `sha256.ts` stays out of it so a client never pulls in `node:crypto`.
- **Chart rules** (`chart/`) are the gate and the arithmetic behind the [charts](../ui/chart/README.md): `spec.ts` validates a chart and `issues.ts` reports what is wrong as plain data, shown as field errors in the editor and returned to an agent; `breakdown.ts`, `scale.ts`, `unitCells.ts`, `format.ts` and `table.ts` do the rest.
- **The message catalog** (`messages/`) is the one place a sentence a visitor reads is written, in whole sentences with `{blanks}`; the accounts and contact keys live in `messages/accounts.ts` and `messages/contact.ts` (decision 0017).
- **Periods two modules share** are `retention.ts` and `linkLifetimes.ts` ([contact](../../modules/contact/README.md), [verification](../../modules/verification/README.md)).
- **Libraries doing real work:** `zod` for the chart spec, `clsx` and `tailwind-merge` for `cn`, and `slugify` from `payload/shared` for `anchorId`; nothing else, on purpose.

## Behaviors and events

- **`readLimitedBody`** reads a request's body as text, counting bytes as they arrive and answering `null` past the limit, so a body that states no length is cut off, not read in full (`readLimitedBody.ts`, #1501).
- **`SlidingWindowCounter`** counts requests in memory, which is one process, and forgets its least recently used key past `maxKeys`; the key is the first `x-forwarded-for` entry, else `x-real-ip` (`slidingWindow.ts`, `clientIp.ts`, #118).
- **`relationId`** is the id of a relationship value, whether Payload gave the populated document or only its id, and `null` when there is none (`relationId.ts`, #1501; the older inline copies in other modules are tracked for switching over).
- **`humanCheck.ts`** is the shape of the robot check that sign-up and the contact form share (decision 0003); the verifier is in [services](../service/README.md).
- **Banners** remember a visitor's closed ones in the browser only, with no personal data, and expire by moment, not calendar day (`dismissedBanners.ts`, `bannerExpiry.ts`, #814).

## Shared pieces it uses

- Nothing outside `src/platform/lib/`; it is the bottom of the dependency order. Used by every module's `domain/`, [Shared Payload code](../payload/README.md) and the [UI kit](../ui/README.md).

## Rules and the tests that protect them

- **Dates are in the site's timezone:** the `SITE_TIMEZONE` environment variable (default `America/Chicago`, Central time) decides "today"; a day-only date is midnight UTC and shows in UTC; a calendar day written `yyyy-mm-dd` is a day, not an instant, so `formatDayLabel` and `formatDayShort` name it in UTC and no zone moves it (`timezone.ts`, `formatDateTime.ts`; `timezone.test.ts`, `formatDateTime.test.ts`).
- **A property-tax bill is worked out in one place:** `billShare.ts` reads the home value a reader types (whole dollars, `$` and commas allowed, nothing else), multiplies it by each body's rate per $1,000, gives whole percents that add to 100 and exact shares for the bar, and takes a rate a body has not set from the year before, saying which. An empty rate or one not above zero is "not set", never zero, and a year with any rate unset has no shares of its own (#1018); the four bodies are named once (`BILL_BODY_NAMES`, #1160) (`billShare.test.ts`).
- **A breakdown can be scaled to a typed value:** every amount is multiplied by a factor, shares unchanged, in whole dollars unless the whole is under $100, the areas adding exactly to the scaled whole and a piece never exceeding its area (largest remainder) (`chart/scale.ts`, #1020; `chart/scale.test.ts`).
- **A chart passes one gate:** limits shared with the editor's block fields; a `breakdown` has up to seven areas (its ramp; other charts take six parts), and its square value is not needed when `hideSquares` leaves the grid out (`chart/spec.ts`, `chart/breakdown.ts`, #866, #943; `chart/spec.test.ts`, `chart/breakdown.test.ts`, `chart/issues.test.ts`).
- **A money field is typed as the reader writes it:** digits grouped by commas after a dollar sign, cents cut, the caret kept; a leading zero is dropped except while deleting (`money.ts`, #1035, #1172; `money.test.ts`).
- **`cn` joins class names** and lets a later Tailwind class win; it knows `bg-hatch` is a background image and that `text-fine` and `text-list-row` are sizes, so they stay beside a text colour (`cn.ts`, #662, #1002, #1163; `cn.test.ts`).
- **Messages throw on a missing value** and durations come in words in whole minutes (`messages/message.ts`, `formatDuration.ts`; `messages/message.test.ts`, `messages/catalog.test.ts`, `formatDuration.test.ts`).
- **One address is one record:** `parseEmailAddress` trims and lowercases; link tokens are stored as hashes (`sha256Hex`), so a database copy holds no working link (`emailAddress.ts`, `sha256.ts`; `emailAddress.test.ts`).
- **Only Google's keyless embed pages pass** as a map address; `getMediaUrl` strips the site origin so uploads read as local files; a focal point becomes a CSS `object-position`, the centre when unset (`googleMapsEmbed.ts`, `getMediaUrl.ts`, `focalPoint.ts`, #1013; `googleMapsEmbed.test.ts`, `getMediaUrl.test.ts`, `focalPoint.test.ts`).
- **Email layout takes fixed paragraphs only,** escaped, with inline colors (`emailLayout.ts`, decision 0004; `emailLayout.test.ts`).
- **A fact says how sure it is:** `confirmed`, `estimate` or `unknown` (`certainty.ts`, #509; `certainty.test.ts`). **A title has one longest length** (`TITLE_MAX_LENGTH` in `contentLimits.ts`, #633). A listing's highest page number is `MAX_PAGE` (`paging.ts`); a chart's limits are `CHART_LIMITS` (`chart/spec.ts`).
- Cursors and paging: `cursor.test.ts`, `paging.test.ts`; review-queue rules: `reviewQueue.test.ts`; retention cutoffs: `retention.test.ts`; limits: `slidingWindow.test.ts`; bounded bodies: `readLimitedBody.test.ts`.

## Boundaries

- No framework, no secrets, no module import (`eslint.boundaries.config.mjs`). `getURL.ts` is the one place the site address is read; never prefix an upload URL by hand.

## Decisions

[0003](../../../docs/architecture/decisions/0003-turnstile-robot-check.md), [0004](../../../docs/architecture/decisions/0004-email-through-smtp.md), [0014](../../../docs/architecture/decisions/0014-cursor-paging-for-load-more.md), [0017](../../../docs/architecture/decisions/0017-one-message-catalog.md).

## Known gaps

None known.
