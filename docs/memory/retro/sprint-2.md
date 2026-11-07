# Sprint 2 Retrospective — Payload CMS Migration

Sprint dates: March 1 - March 14, 2026

---

## Observations

<!-- Agents: append your observations below using this format -->
<!--
### [Date] — [Agent Role]
- **Observation**: What happened
- **Impact**: How it affected the work
- **Recommendation**: What to change or continue
-->

### 2026-03-01 — Ops Lead / All Agents

- **Observation**: MCP tools (Slack) are not available to spawned subagents — only the main conversation can use them
- **Recommendation**: Always handle Slack operations in the main conversation. Don't attempt to delegate MCP-dependent tasks to subagents

- **Observation**: Major architectural pivot from Better Auth to Payload CMS native auth + payload-oauth2, plus rebuilding from the Payload Website Template
- **Impact**: 30 Sprint 2.x tasks superseded, all 12 agent profiles updated with new CMS knowledge, new 20-task sprint created
- **Recommendation**: When a pivot this large happens, update all agent profiles and memory files in the same session to prevent stale context

### 2026-03-03 — Frontend Engineer

- **Observation**: Adding SEO plugin fields to a collection (Events) does not automatically update `payload-types.ts`. The `defaultPopulate` type check fails because `EventsSelect` has no `meta` key yet. We used `as any` with a comment explaining the workaround until `payload generate:types` is re-run.
- **Impact**: Minor — requires a follow-up types regeneration step before the `defaultPopulate` optimization for `meta` fields can be fully typed. Runtime behavior is correct.
- **Recommendation**: After merging any PR that adds SEO plugin fields to a new collection, run `npx payload generate:types` and commit the updated `payload-types.ts` in a separate housekeeping PR.

- **Observation**: The SEO plugin's `GenerateURL` callback receives `collectionConfig` (a full `CollectionConfig` object), not a `collectionSlug` string. Using `collectionConfig.slug` is the correct way to branch on collection type.
- **Impact**: None — caught during implementation before committing.
- **Recommendation**: Document this pattern in `skill-payload-cms.md` to avoid the same confusion next time a collection is added to the SEO plugin.

- **Observation**: The `EventHero` dual-mode pattern (full-bleed image vs. clean header fallback) works cleanly and matches `PostHero` conventions. Using a single component with conditional rendering keeps the detail page lean.
- **Impact**: Positive — event pages with and without hero images both render correctly with correct header theme management.
- **Recommendation**: Adopt this same dual-mode pattern for any future content-type heroes.

---

## Weekly Review Notes

<!-- Amine: add your weekly review notes here -->

### Week of March 1, 2026

- _Pending review_

---

## Biweekly Retro Summary

<!-- Filled in during the biweekly retrospective meeting -->

### Actions Decided

- _Pending first retro_

### Process Changes

- _Pending first retro_
