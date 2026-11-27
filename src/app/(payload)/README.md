---
name: 'Payload routes'
type: feature
summary: 'admin, REST, GraphQL, access, API headers.'
aliases: ['admin panel', 'REST API', 'GraphQL']
relationships: []
---

# Payload routes

The routes Payload generates and serves under `src/app/(payload)/`: the admin panel at `/admin`, the REST and GraphQL APIs under `/api`, and the GraphQL playground. They are Payload's own files (marked as generated, never edited here); what the site changes is in `src/payload.config.ts` ([the app shell](../README.md)). What each content type allows over these routes: the [content types](../../../docs/reference/content-types/README.md); every address: the [endpoints reference](../../../docs/reference/endpoints.md).

## How the pieces link

- **Where the settings are:** admin routes and the Forgot and Verify paths are named once in `src/platform/payload/adminRoutes.ts` and read by the config and by `src/proxy.ts`, which sends those two admin pages to the site's own (see [accounts](../../modules/accounts/README.md)).
- **The MCP address** `/api/mcp` is served through the same catch-all REST route and is set up by the [agents](../../modules/agents/README.md) module.
- **The admin's own look:** `custom.scss` and the components named in the config (`src/platform/payload/admin/`: the login notice, the dashboard note, the seed button, the suggestions filter).
- **Libraries doing real work:** `@payloadcms/next` renders the admin and the routes.

## Behaviors and events

- **The playground and GraphQL are open to the content types' own access rules;** the site makes no GraphQL calls and only the account verify mutation is refused (`src/payload.config.ts`, `src/modules/accounts/cms/verifyFromSiteOnly.ts`).
- **Search engines are told to skip `/admin/*`** (`src/app/robots.ts`).

## Shared pieces it uses

- The shared Payload helpers behind each collection's access ([Shared Payload code](../../platform/payload/README.md)).

## Rules and the tests that protect them

- **The API carries the same access rules as the admin:** a visitor reads published documents only, and a non-staff create becomes a held suggestion (`src/payload.config.roles.test.ts`, `src/payload.config.protectedFields.test.ts`, `src/payload.config.reviewQueueApi.test.ts`).
- **Every `/api/` answer but an upload under `/api/media/file/` says `X-Robots-Tag: noindex`** (`API_HEADERS` in `next.config.js`), which only asks search engines to skip it; access rules keep data private. Payload's own headers apply too, with `Critical-CH` moved to the admin path only (`criticalHintForAdminOnly`); the pages that refuse framing are in the [accounts note](../../modules/accounts/README.md) (`src/app/apiHeaders.test.ts`, `src/app/criticalHint.test.ts`).

## Boundaries

- Never edit these files by hand: Payload rewrites them (the importmap under `admin/` is generated).

## Decisions

Issue #115 (generated files are not rewritten in the deploy); the GraphQL question is open (see [news](../../modules/news/README.md)).

## Known gaps

- What GraphQL is for has not been decided; it is available for any collection or global.
