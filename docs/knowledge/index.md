# Knowledge index

How the site is put together, one line per entry. Read the line, then open the note or reference
it points to. Notes load by themselves when the work touches their files; the reference is
generated. Why: decision [0019](../architecture/decisions/0019-knowledge-layer.md).

## Notes

- [Events](../../src/modules/events/README.md): the calendar, its listings, category pages and "this week" block; what "upcoming" means, what a save refreshes, official meetings, cancelled events, suggestions held as drafts.
- [Contact](../../src/modules/contact/README.md): form checks, emails held until the sender confirms, retention.
- [Agents](../../src/modules/agents/README.md): MCP access, what agents may read, suggestions held as drafts, run history.
- [Verification](../../src/modules/verification/README.md): email confirmation by link, its limits, the welcome email, retention.
- [Directory](../../src/modules/directory/README.md): the FAQ and resources pages; how entries are grouped, when an official's photo shows, what a save refreshes.
- [Theme](../../src/platform/theme/README.md): tokens, light and dark mode, theme options and decorations.
- [Accounts](../../src/modules/accounts/README.md): sign-up, verification, sign-in, password changes and resets, and the guards on each.
- [Site navigation](../../src/modules/site/navigation/README.md): header, footer, forum link, redirects, refresh timing.
- [UI kit](../../src/platform/ui/README.md): shared components' behavior: links, charts, version check, staff bar, shared sizes.

## Reference (generated)

- [Content types](../reference/content-types/README.md): every collection and global, plugins included: fields, access per operation, hooks, drafts. `npm run docs:generate` writes it; CI (`Knowledge sync`) checks it.
- [Screens](../reference/routes.md): every `page.tsx` and `route.ts` under `src/app/(frontend)/`: URL, the module entry points it imports, rendering and revalidate, where its metadata comes from.
- [Shared components](../reference/components/README.md): every component of `src/platform/ui/` and `src/platform/richtext/` with its props, variants and the modules and routes that use it. Rules and decided choices stay in [component-set.md](../ui/component-set.md).
- [UI element coverage](../reference/ui-coverage.md): which component and variant each element of the UI inventory maps to, with counts; made from the element tables in `docs/ui/`. Edit the table, not this page.
