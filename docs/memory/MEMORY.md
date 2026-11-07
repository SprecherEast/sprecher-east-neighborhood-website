# Sprecher East Neighborhood Website

> **Historical notes.** The phase names below ("Phase 1", "Phase 2") describe the site's rebuild history, not today's roadmap, and the folder trees below (`src/components/` and the rest) are from that time too. Current work is tracked in GitHub issues (see #127 and #122); how the code is organized is in [`docs/architecture/`](../architecture/README.md).

## Single Source of Truth

- **Strategy docs (private, archived):** GitHub: `boulaajaj/sprecher-east-strategy`, read-only history since #538
- **Website code (public):** This repo → GitHub: `boulaajaj/sprecher-east-neighborhood-website` (PUBLIC)
- **Asana role tags:** All tasks use `[R#-Role]` prefix (history only: the archived strategy repo)

## Project Summary

Full rebuild of sprechereast.com. Phase 1 was static HTML. Phase 2 is migrating to the
Payload CMS v3 Website Template with native auth + payload-oauth2 plugin. Single SQLite database.

## Current Stack (Phase 2 — Migration In Progress)

- **Framework**: Next.js 15 (App Router, TypeScript)
- **CSS**: Tailwind CSS v4 (design tokens in `src/app/globals.css @theme {}`)
- **UI Components**: shadcn/ui (Radix UI + Tailwind styling)
- **CMS**: Payload CMS v3 Website Template at `/admin` (self-hosted, SQLite `data/payload.db`)
  - Layout builder with 8 block types (Archive, CallToAction, Content, FormBlock, MediaBlock, etc.)
  - Lexical rich text editor, live preview, draft preview, scheduled publishing
  - Plugins: SEO, Form Builder, Search, Redirects, Nested Docs
- **Auth**: Payload CMS native auth + `payload-oauth2` by Wilson Le (replaces Better Auth)
  - Single `data/payload.db` database (no separate auth.db)
  - JWT tokens, cookie-based sessions, built-in login/logout/forgot-password
- **Icons**: Lucide React
- **Hosting**: Hostinger VPS (Ubuntu 24.04, PM2 + Caddy) — live at http://187.77.27.93
- **Docs**: https://payloadcms.com/llms-full.txt (Payload CMS LLM reference)

## Component Architecture (DDD / Fractal)

```
src/components/
  ui/                         ← atomic, domain-agnostic primitives
    badge.tsx                   CategoryBadge, StatusBadge, TagBadge
    page-header.tsx             PageHeader (eyebrow, h1, description)
    empty-state.tsx             EmptyState (icon, title, description)
    section-header.tsx          SectionHeader (eyebrow, h2, view-all link)
    container.tsx               Container (max-w-6xl wrapper)
    index.ts
  features/
    events/                   ← events domain components
      event-card.tsx, event-detail-card.tsx, event-date-badge.tsx, event-list.tsx, index.ts
    posts/                    ← posts domain components
      post-card.tsx, post-feed-item.tsx, post-grid.tsx, post-feed.tsx, index.ts
  sections/                   ← full-width page sections
    hero.tsx, feature-strip.tsx, about-preview.tsx, events-news.tsx, cta-banner.tsx, index.ts
  layout/
    Nav.tsx                   'use client' — includes UserMenu (auth widget)
    Footer.tsx                Server component
    UserMenu.tsx              'use client' — shows Sign In or user avatar + dropdown
```

## Project File Structure (Legacy — will be replaced by Website Template scaffold)

```
src/
  app/
    layout.tsx                Root (Poppins via next/font, metadata)
    globals.css               Tailwind v4 @theme block (all design tokens)
    (site)/layout.tsx         Shared Nav + Footer wrapper
    (site)/page.tsx           Homepage — uses sections/*
    (site)/about/page.tsx
    (site)/association/page.tsx
    (site)/events/page.tsx
    (site)/news/page.tsx
    (site)/resources/page.tsx
    (site)/get-involved/page.tsx
    (site)/contact/page.tsx + ContactForm.tsx ('use client')
    (site)/login/page.tsx     'use client' — social + email login
    (payload)/admin/[[...segments]]/page.tsx   Payload admin UI
    (payload)/api/[...slug]/route.ts           Payload REST API
    api/auth/[...all]/route.ts  Better Auth catch-all
    api/contact/route.ts      Contact form handler (logs only — needs email wired)
  lib/
    types.ts                  Shared TS types (Event, Post, BoardMember)
    data.ts                   Reads from Payload Local API, falls back to JSON
    auth.ts                   Better Auth server config (server-only)
    auth-client.ts            Better Auth client hooks (useSession, signIn, signOut)
    utils.ts                  formatDate, getDateParts, cn()
  middleware.ts               Protects /profile routes via session cookie check
  payload/collections/        Payload CMS schemas
    Events.ts, Posts.ts, BoardMembers.ts, Users.ts, Media.ts
payload.config.ts             Payload config (SQLite, collections, admin)
data/
  payload.db                  (SQLite — gitignored, created at runtime)
public/images/               Photos, also read by the demo seed (src/endpoints/seed)
```

## Design Tokens (src/app/globals.css @theme block)

- `--color-primary: #3d7a5e` → `bg-primary`, `text-primary`, `border-primary`
- `--color-accent: #e8923a` → `bg-accent`, `text-accent`
- `--color-background: #f9f8f5` → `bg-background`
- `--color-surface: #f0ede6` → `bg-surface`
- `--color-foreground: #1a1a1a` → `text-foreground`
- `--color-muted: #6b6b6b` → `text-muted`
- `--color-border: #e2ddd6` → `border-border`

## Local Setup (Post-Migration)

```bash
npm install
cp .env.local.example .env.local   # fill in PAYLOAD_SECRET + DATABASE_URI + SERVER_URL (see env vars below)
mkdir -p data                       # already exists if repo was cloned with data/
npm run dev                         # → http://localhost:3000 (dev server also generates importMap.js)
# First visit to /admin → one-time "Create first admin" setup screen (creates payload.db)
```

## Env Vars Required (Post-Migration)

| Var                       | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `PAYLOAD_SECRET`          | Payload JWT signing (32+ chars)                 |
| `DATABASE_URI`            | `file:./data/payload.db`                        |
| `NEXT_PUBLIC_SERVER_URL`  | `http://localhost:3000` (dev) or production URL |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth via payload-oauth2 (optional)      |
| `GITHUB_CLIENT_ID/SECRET` | GitHub OAuth via payload-oauth2 (optional)      |

> **Legacy note:** `BETTER_AUTH_SECRET` and `NEXT_PUBLIC_APP_URL` are no longer needed. Better Auth was removed in Sprint 2.

## CMS & Auth Key Notes

- **Single database**: All data (content + users + auth) in `data/payload.db` (SQLite)
- **Better Auth REMOVED**: Was causing sign-up hangs, password bugs, dual-DB complexity
- **Payload native auth**: `auth: true` on Users collection, JWT sessions, built-in login/register
- **payload-oauth2**: Plugin by Wilson Le (provider-agnostic OAuth2; Google tested with examples, Apple has example config). Starting with Google; more providers configured as needed.
- First Payload admin created by visiting `/admin` on a fresh DB (one-time setup UI)
- `overrideAccess: true` required in all server-side Payload reads (no session in RSC)
- Website Template provides: layout builder, live preview, draft system, SEO plugin, form builder

## Navigation

Home → About → Events → News → Resources → Get Involved → [Contact] (CTA) + [Sign In] (UserMenu)
Association page at `/association` (footer link, not in main nav)

## Known Gotchas (build-verified)

- **Payload REST route**: `REST_GET(config)` — curried; NOT `REST_GET(req, config)`
- **Payload admin importMap**: Auto-generated by Payload dev server on first run. Committed to repo.
  Lives at `src/app/(payload)/admin/importMap.js`
- **`defaultSort`**: Must be on collection root level, NOT inside `admin: {}`
- **npm installs**: Always use `--legacy-peer-deps` for Payload packages (peer dep conflicts)
- **`graphql` package**: Must install separately — `@payloadcms/graphql` doesn't bundle it
- **`npx payload run` fails on Node v24**: `payload/dist/bin/loadEnv.js` incompatible. Use direct node scripts instead.
- **Asana REST API**: Use `$ASANA_PAT` (user env var) with `curl` instead of MCP tools. Supports comments, subtasks, attachments. On Windows, pass JSON via temp file to avoid escaping issues.
- **MCP tools limitation**: Slack MCP tools only work in the main conversation, NOT in spawned subagents
- **Write tool requires prior Read**: Always read a file before writing it

## DDD Architecture Guidelines

- `ui/` = pure presentational, no domain knowledge
- `features/{domain}/` = domain-specific, composed from ui primitives
- `sections/` = full-page sections, composed from features + ui
- `layout/` = app shell (Nav, Footer, UserMenu)
- Barrel exports in `index.ts` per folder; files max ~300 lines

## VPS Info

See `memory/vps.md` for full server details.
Site live at http://187.77.27.93 (PM2 + Caddy reverse proxy).
CI/CD: push to `main` → GitHub Actions → SSH deploy → `npm ci && npm run build && pm2 reload`.
VPS first-deploy extra steps: create `data/` dir, set env vars, run seed script, create admin user at /admin.

## Sprint 2 — Payload CMS Migration

**Status**: In progress (started March 1, 2026)

**Key Decisions Made:**

- Migrate from Better Auth to Payload native auth + payload-oauth2
- Rebuild from Payload CMS v3 Website Template (Option A — fresh scaffold, same repo)
- Single SQLite database (no more separate auth.db)
- All content CMS-driven via layout builder blocks
- Sprint retrospective practice added to all 12 agents (biweekly cycle)

**Current Priorities:**

1. Update CLAUDE.md to reflect new architecture
2. Scaffold website template on feature branch
3. Configure CMS collections (Events, BoardMembers, FAQ)
4. Implement auth (payload-oauth2 for Google/GitHub)
5. Migrate content and deploy

See `docs/memory/progress.md` for full history and `docs/memory/retro/sprint-2.md` for retrospective log.
