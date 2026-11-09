# Shared Payload code

The helpers every collection is built from (`src/platform/payload/`) and the helpers modules share (`lib/`, `seo/`, `email/`, `turnstile/`, `service/` beside it). The rules a module note states (staff see drafts, suggestions wait as drafts, publishes are scheduled, limits are counted in memory) are defined here. Access functions and hooks per collection: [content types](../../../docs/reference/content-types/README.md).

## How the pieces link

- `REVIEW_QUEUE_FIELDS` (source name and link, audience, review status, `externalId`, `contentHash`) are spread into events and posts. `holdSuggestions` sets `suggested` and a draft on a non-staff create, and staff publishing sets `approved`. Admin's Duplicate clears the review status, `externalId` and `contentHash`, and keeps source and audience (`payload/reviewQueue.ts`, `lib/reviewQueue.ts`, `payload/admin/SuggestionsFilter.tsx`).
- `draftContentAccess` gives staff drafts and versions and everyone else published documents only; `suggestibleContentAccess` (events, posts) also lets agents create, which `holdSuggestions` holds. `readVersions` is set because Payload's default lets any signed-in user read drafts (`payload/draftContentAccess.ts`, #140). Roles are in `lib/roles.ts`, the checks in `payload/roles.ts`.
- `draftVersions` (pages, posts, events) turns on autosave and scheduled publishing; FAQ and resources have plain drafts with neither. `previewAdmin` builds the Preview and Live Preview address from the slug (`generatePreviewPath.ts`). `seoTab` is the one SEO tab of pages, posts and events, stored under `meta`; `generateMeta` reads its title, description and image for cards and share previews (`payload/contentCollection.ts`, `payload/seoTab.ts`, `seo/generateMeta.ts`).
- `populatePublishedAt` stamps `publishedAt` when the request body has none (pages, events, FAQ, resources); posts set it in their own field hook (`payload/populatePublishedAt.ts`, `news/cms/posts.ts`).
- The link field stores a reference or a custom URL; `resolveLink` is the one place it becomes an `href`. `documentHref` is the one place a document's address is written: pages at `/slug`, the slug `home` at `/`, the rest under their collection (`payload/link.ts`, `resolveLink.ts`, `documentHref.ts`).
- `keysetSort` and `afterCursor` order a listing by one date with the id as tie-break; `lib/cursor.ts` encodes that pair as the opaque cursor "Load more" sends back on events and news (`payload/keyset.ts`, decision 0014).
- `emailConfirmer.ts` is the contract [verification](../../modules/verification/README.md) provides and [contact](../../modules/contact/README.md) uses; accounts only supplies a keeper (`keepAccountEmails`), and sign-up uses Payload's own verify, not this contract; `payload.config.ts` hands them over (decision 0008).

## Behaviors and events

- Roles are `admin`, `editor`, `guest`, `resident`, `agent`; only admin and editor are staff, guest and resident have the same access, and a principal from another collection (an MCP API key acting as itself) counts as signed out (`payload/roles.ts`).
- `PUBLISHED` filters on `_status` even for a staff caller, so public listings never show drafts; `authenticatedOrPublished` lets staff read everything and others published only (`payload/published.ts`, `authenticatedOrPublished.ts`).
- Payload adds edit locks and job stats with access for any signed-in user and no option to change it, so `restrictEditLocks` (staff) and `restrictJobStats` (admin) reset it on the built config, after it is built (`payload/restrictEditLocks.ts`, `restrictJobStats.ts`, `src/payload.config.ts`). Editors may queue and cancel jobs; only admins run them (`src/payload.config.ts`).
- A create by a non-staff user (REST, GraphQL, MCP, or the Local API with a user) is stored as a `suggested` draft and must name a source and an http(s) source link; any other write by them is refused; server code with no user (the seed) passes. Blank text becomes null, so unique `externalId` and `contentHash` never collide on blanks (`payload/reviewQueue.ts`, `lib/reviewQueue.ts`).
- Admin lists show how many suggestions wait, counted from each document's latest draft, with a filter link (`countSuggestions`, `payload/admin/SuggestionsFilter.tsx`).
- Jobs run inside the app's one process: scheduled publishing every minute (`default` queue, at most 10 per run) and the retention queue every 10 minutes. Payload starts them on the first request through its routes, never during build, and each runner names its queue (`payload/jobRunners.ts`, `retentionJobs.ts`, decisions 0010 and 0011).
- Retention tasks are scheduled hourly; a job left processing for over an hour is queued again, and a failed task logs only its name, the error's name and code (`payload/retentionJobs.ts`).
- `expireCacheTag` drops a tag now, as `revalidateTag(tag)` did before Next 16; hooks run outside actions, where `updateTag` isn't available (`payload/expireCacheTag.ts`). A scheduled publish runs outside a request and can't expire tags, so pages catch up within 10 minutes (decision 0011, `src/app/sitemap.ts`).
- The seed is on in any non-production build and off in production with no switch; its route answers 404 there and admins only elsewhere (`payload/isSeedEnabled.ts`, `src/app/(frontend)/next/seed/route.ts`).
- Media: staff upload, anyone reads, only admin deletes; `alt` is required; credit, license, license link and an optional source link (empty or http(s)). `toLicenseName` makes the credit line, taking a Creative Commons version from the license link. `imagesOnly` limits upload fields to pictures; `toImageRef` gives the image only once populated (`payload/media.ts`, `lib/mediaLicenses.ts`, `imagesOnly.ts`, `imageRef.ts`).
- Rate limits count in memory, which is one process: `SlidingWindowCounter` forgets its least recently used key past `maxKeys`. The key is the first `x-forwarded-for` entry, else `x-real-ip`; direct access to the app could spoof it, so it only keys limits (`lib/slidingWindow.ts`, `lib/clientIp.ts`, #118).
- Dates: `SITE_TIMEZONE` (env, default Central) decides "today"; day-only dates are midnight UTC and show in UTC, other timestamps in the site timezone (`lib/timezone.ts`, `lib/formatDateTime.ts`).
- Messages are whole sentences with `{blanks}`; `message()` throws on a missing value, and durations come in words from `formatDuration` (whole minutes). `retention.ts` and `linkLifetimes.ts` hold the periods two modules share (`lib/messages/`, `lib/formatDuration.ts`, decision 0017).
- Email layout takes fixed paragraphs only, escaped, with inline colors (`lib/emailLayout.ts`, decision 0004). `emailAdapterFromEnv` builds SMTP from `SMTP_*`; with no host, or a bad setting (address, port, half a login), it logs and emails go to the log; with a login it insists on STARTTLS (`email/emailAdapter.ts`).
- Robot check: off until both Turnstile keys are set; the server fails closed on any error, checks action and hostname, and sends no IP. The widget appears only when Cloudflare asks (`interaction-only`), and a token is single use, so `useRobotCheck` renews it after each attempt (`turnstile/turnstileVerifier.ts`, `TurnstileWidget.client.tsx`, `useRobotCheck.client.ts`, decision 0003).
- Search engines: account and token pages use `NOT_INDEXED`; a page whose address holds a token also sends no referrer (`seo/notIndexed.ts`, `privateAddress.ts`, #280). `mergeOpenGraph` fills site defaults, and the image is the `og` size, else the upload, else a default photo (`seo/mergeOpenGraph.ts`, `generateMeta.ts`).
- `runUseCase` catches, logs only the error's class name (never a message with an email in it) and returns the fallback; `runAction` turns a throw into a failure code and logs it only when that code is `server-error`, since any other code is an expected refusal (`service/runUseCase.ts`, #521).
- Small helpers: `getMediaUrl` strips the site origin so next/image reads uploads as local files; `sha256Hex` stores link tokens as hashes, so a database copy holds no working link; `parseEmailAddress` trims and lowercases, so one address is one record; `toGoogleMapsEmbedUrl` accepts only Google's keyless embed pages (`lib/getMediaUrl.ts`, `sha256.ts`, `emailAddress.ts`, `googleMapsEmbed.ts`).
- `parseChartSpec` is the one gate a chart passes, its limits shared with the editor's block fields, and the optional `palette` (the usual colors or orange and gray) is one of them, as is the `breakdown` kind with its square value (not needed when `hideSquares` leaves the grid out, #943), up to seven areas and their pieces (`lib/chart/spec.ts`, `lib/chart/breakdown.ts`, #866); `isLinkAddress` accepts a site path or an http(s) address (`lib/linkAddress.ts`).

## Rules and the tests that protect them

- Visitors and residents do only what the policy allows, and only published documents show: `payload/accessPolicy.test.ts`, `accessPolicy.fields.test.ts`, `src/payload.config.roles.test.ts`, `src/payload.config.protectedFields.test.ts`, `payload/roles.test.ts`.
- Suggestions are held, approved by publishing, de-duplicated and not copied by Duplicate: `src/payload.config.reviewQueue.test.ts`, `reviewQueueApi.test.ts`, `lib/reviewQueue.test.ts`.
- Scheduled publishing and the runners: `src/payload.config.scheduledPublishing.test.ts`, `payload/jobRunners.test.ts`, `retentionJobs.test.ts`, `restrictJobStats.test.ts`, `restrictEditLocks.test.ts`.
- Titles stop at one shared limit when publishing, not when saving a draft: `src/payload.config.titleLimit.test.ts`, `payload/contentCollection.test.ts`.
- Links, paging and cursors: `payload/resolveLink.test.ts`, `documentHref.test.ts`, `keyset.test.ts`, `lib/cursor.test.ts`, `lib/paging.test.ts`.
- Limits, dates, messages and email: `lib/slidingWindow.test.ts`, `clientIp.test.ts`, `timezone.test.ts`, `formatDateTime.test.ts`, `formatDuration.test.ts`, `retention.test.ts`, `emailLayout.test.ts`, `lib/messages/*.test.ts`, `email/emailAdapter.test.ts`.
- The robot check, metadata and the service helper: `turnstile/turnstileVerifier.test.ts`, `seo/generateMeta.test.ts`, `seo/privateAddress.test.ts`, `service/runUseCase.test.ts`.

## Shared pieces it uses

- It uses Payload's own types and plugins (the SEO plugin's fields in `seoTab`, the Nodemailer adapter) and the site timezone; modules meet each other only through `src/payload.config.ts` and the pages in `src/app/` (decision 0008).
- Module notes that rely on it: [events](../../modules/events/README.md) and [news](../../modules/news/README.md) (review queue, drafts, keyset paging), [agents](../../modules/agents/README.md) (review queue, roles), [contact](../../modules/contact/README.md) and [verification](../../modules/verification/README.md) (confirmer contract, retention), [accounts](../../modules/accounts/README.md) (roles), [UI kit](../ui/README.md) (`AdminBar` reads `isStaffRole`).

## Boundaries

- `lib/index.ts` is the framework-free surface a module's domain may import; `sha256.ts` stays out of it so clients never pull in `node:crypto`. `payload/` is for `data/`, `cms/`, `platform/` and `src/payload.config.ts` only. Nothing here imports a module (`eslint.boundaries.config.mjs`).

## Decisions

[0003](../../../docs/architecture/decisions/0003-turnstile-robot-check.md), [0004](../../../docs/architecture/decisions/0004-email-through-smtp.md), [0008](../../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md), [0010](../../../docs/architecture/decisions/0010-contact-data-retention.md), [0011](../../../docs/architecture/decisions/0011-scheduled-publishing-runner.md), [0014](../../../docs/architecture/decisions/0014-cursor-paging-for-load-more.md), [0016](../../../docs/architecture/decisions/0016-one-service-helper-no-pass-through-use-cases.md), [0017](../../../docs/architecture/decisions/0017-one-message-catalog.md).

## Known gaps

- The link field's custom URL isn't checked with `isLinkAddress`, and `resolveLink` passes it through as typed; only editorial links and chart sources are checked (`payload/link.ts`, `payload/resolveLink.ts`).
- `populatePublishedAt` reads the request body, not the document, and has no test of its own.
