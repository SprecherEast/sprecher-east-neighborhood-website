# Knowledge index

How the site is put together, one line per entry: open the note or reference a line points to. Notes load by themselves when the work touches their files; the reference is
generated. Why: decision [0019](../architecture/decisions/0019-knowledge-layer.md).

## Notes

- [Events](../../src/modules/events/README.md): the calendar, listings, category pages, "this week" block; "upcoming", save refreshes, official meetings, cancelled events, suggestions as drafts.
- [Contact](../../src/modules/contact/README.md): form checks, emails held until the sender confirms, retention.
- [Agents](../../src/modules/agents/README.md): MCP access, what agents may read, drafts, run history.
- [Verification](../../src/modules/verification/README.md): email confirmation by link, limits, welcome email, retention.
- [Directory](../../src/modules/directory/README.md): the FAQ and resources pages; grouping, official photos, save refreshes.
- [Theme](../../src/platform/theme/README.md): tokens, light and dark mode, theme options, decorations.
- [Roadmap](../../src/modules/roadmap/README.md): the public plan page.
- [Accounts](../../src/modules/accounts/README.md): sign-up, verification, sign-in (password, Google, passkey), adding a passkey, resets, guards.
- [Site navigation](../../src/modules/site/navigation/README.md): header, footer, forum link, redirects, refresh timing.
- [UI kit](../../src/platform/ui/README.md): shared components' behavior: links, version check, staff bar, sizes.
- [Charts and data displays](../../src/platform/ui/chart/README.md): charts, adapters, breakdowns, heat map, share bill.
- [Site pages](../../src/modules/site/README.md): page hero and blocks, what a page save refreshes.
- [Shared Payload code](../../src/platform/payload/README.md): roles, drafts, review queue, jobs, link and site-address helpers, keyset paging.
- [Preview copy](../../src/platform/payload/previewCopy/README.md): what a preview copies from the published site.
- [Rich text](../../src/platform/richtext/README.md): article text, editorial blocks, Markdown tags.
- [News](../../src/modules/news/README.md): posts, bylines, sources, search, the category tree, "top issues".

## Reference (generated)

- [Content types](../reference/content-types/README.md): every collection and global, plugins included: fields, access per operation, hooks, drafts.
- [Screens](../reference/routes.md): every `page.tsx` and `route.ts` under `src/app/(frontend)/`: URL, the module entry points it imports, rendering and revalidate, where its metadata comes from.
- [Shared components](../reference/components/README.md): every component of `src/platform/ui/` and `src/platform/richtext/` with its props, variants and the modules and routes that use it. Rules and decided choices stay in [component-set.md](../ui/component-set.md).
- [UI element coverage](../reference/ui-coverage.md): which component and variant each element of the UI inventory maps to, with counts; made from the element tables in `docs/ui/`. Edit the table, not this page.
