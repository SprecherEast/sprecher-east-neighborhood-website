# Next Session Plan

**Last updated:** March 1, 2026
**Sprint:** Sprint 2 — Payload CMS Migration

---

## Decisions Made (Context for Next Session)

1. **Auth**: Migrating from Better Auth to Payload native auth + `payload-oauth2` plugin
2. **Template**: Rebuilding from Payload CMS v3 Website Template (fresh scaffold)
3. **Repo**: Same repo, new feature branch — preserves CI/CD, GitHub Actions secrets, branch protection
4. **Database**: Single SQLite `data/payload.db` — no separate `auth.db`
5. **Content**: All content CMS-driven via layout builder blocks (8 block types + 4 hero types)
6. **Sprint retro**: Added to all 12 agents — biweekly cycle, shared file at `docs/memory/retro/sprint-2.md`

## Priority 1: Update CLAUDE.md

Before any scaffolding, update the project CLAUDE.md to reflect:

- New stack (Payload Website Template, payload-oauth2, shadcn/ui, single DB)
- Removed Better Auth references and gotchas
- New file structure from the website template
- Updated env vars (remove BETTER_AUTH_SECRET, add payload-oauth2 config)
- Updated setup instructions

## Priority 2: Scaffold Website Template

1. Create branch: `agent/C-Builder/payload-migration`
2. Install Payload CMS v3 Website Template
3. Port design tokens (primary, accent, background, surface, foreground, muted, border)
4. Configure for Sprecher East branding (Poppins font, logo, nav items)
5. Verify dev server starts and `/admin` works

## Priority 3: CMS Configuration

1. Custom collections: Events, BoardMembers, FAQ
2. Header/Footer globals with nav links
3. Seed data migration from `data/*.json`
4. Configure payload-oauth2 for Google OAuth

## Key Resources

- Payload CMS docs: https://payloadcms.com/llms-full.txt
- payload-oauth2: https://github.com/wilsonle/payload-oauth2
- Website Template: https://github.com/payloadcms/payload/tree/main/templates/website

## Carried-Over Sprint 1 Tasks (ON HOLD)

- Blog post draft (blocked by migration)
- Social media launch (blocked by migration)
- Strategy doc review (blocked by migration)
