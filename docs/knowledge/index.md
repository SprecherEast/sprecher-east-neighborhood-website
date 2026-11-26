# Knowledge index

One line per entry. Notes load when the work touches their files. Why: [0019](../architecture/decisions/0019-knowledge-layer.md).

## Notes

- [Events](../../src/modules/events/README.md): calendar, listings, "this week", official meetings.
- [Contact](../../src/modules/contact/README.md): form checks, emails held until confirmed.
- [Agents](../../src/modules/agents/README.md): MCP access, drafts, runs.
- [Verification](../../src/modules/verification/README.md): email confirmation by link, retention.
- [Directory](../../src/modules/directory/README.md): the FAQ and resources pages.
- [Theme](../../src/platform/theme/README.md): tokens, light and dark mode, theme options.
- [Roadmap](../../src/modules/roadmap/README.md): the public plan page, read from GitHub.
- [Accounts](../../src/modules/accounts/README.md): sign-up, sign-in (password, Google, passkey).
- [Site navigation](../../src/modules/site/navigation/README.md): header, footer, forum link, redirects.
- [UI kit](../../src/platform/ui/README.md): shared components beyond their props.
- [Charts and data displays](../../src/platform/ui/chart/README.md): charts, breakdowns, heat map, share bill.
- [Site pages](../../src/modules/site/README.md): CMS pages: hero, blocks, refresh on save.
- [Shared Payload code](../../src/platform/payload/README.md): roles, drafts, review queue, jobs, media.
- [Shared helpers](../../src/platform/lib/README.md): pure helpers: dates, money, bill share.
- [Platform services](../../src/platform/service/README.md): email, robot check, counter, metadata.
- [Preview copy](../../src/platform/payload/previewCopy/README.md): what a preview copies from the live site.
- [Rich text](../../src/platform/richtext/README.md): article text, editorial blocks, Markdown tags.
- [Whole tax bill](../../src/platform/richtext/editorial/README.md): the tax-bill tab: estimator, rates, whole bill.
- [News](../../src/modules/news/README.md): posts, bylines, search, categories, "top issues".
- [Site shell and composition root](../../src/app/README.md): layout, sitemap, proxy, Payload config.
- [Payload admin and API routes](<../../src/app/(payload)/README.md>): the admin panel and REST and GraphQL routes.
- [Component gallery](<../../src/app/(frontend)/dev/README.md>): development-only page of every component.
- [Seed and preview accounts](../../src/endpoints/seed/README.md): demo content and the preview accounts.

## Reference (generated)

- [Content types](../reference/content-types/README.md): collections and globals: fields, access, hooks.
- [Screens](../reference/routes.md): every page and route file.
- [Endpoints](../reference/endpoints.md), [MCP tools](../reference/mcp-tools.md), [jobs](../reference/jobs.md): what runs without a page.
- [Shared components](../reference/components/README.md): props, variants, where used.
- [UI element coverage](../reference/ui-coverage.md): which component covers each element.
