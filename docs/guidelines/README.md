# Guidelines

How code and content are written in this repo, by topic. They apply to every contributor, human or
AI agent, whatever tool they use. [`AGENTS.md`](../../AGENTS.md) has the rules for how changes
reach `main`; it wins if anything here disagrees with it.

Guidelines say how things should be. Step-by-step procedures are Agent Skills in
[`.agents/skills/`](../../.agents/skills/), and facts about the system are in
[`docs/project.md`](../project.md) and [`docs/architecture/`](../architecture/README.md).

Guard rails load into every session ([`CLAUDE.md`](../../CLAUDE.md) imports them, and
[`AGENTS.md`](../../AGENTS.md) summarizes them). Every other reference loads by itself as soon as the
work reads or edits a file that matches its globs, so a session only carries what its task needs.
Read one by hand whenever a task needs it and it hasn't loaded (#144). This table is the one place
the globs are written: `scripts/agent-context.mjs` copies each listed reference into the Claude Code
adapter with them, and CI fails when a copy is out of date or when what loads at session start passes
its token budget (`BUDGET_TOKENS` in that script, #737; counted with an offline approximation of Claude's
tokenizer, so treat it as a close guide, not an exact figure).

| Reference                                                | Loads by itself when the work touches                                                                                                                                                                         | Read it when                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Guard rails](guard-rails.md)                            | Always loaded                                                                                                                                                                                                 | Always, before any change: the non-negotiable rules and what enforces them.                   |
| [Development](development.md)                            | `src/**`, `scripts/**`, `intelligence/**`, `ops/**`, `e2e/**`, `.claude/hooks/**`, `*.config.*`, `package.json`, `docs/guidelines/**`, `docs/roles/**`, `docs/ui/**`, `.agents/skills/**`                     | Any code change: native first, configuration over code, DRY, failing explicitly.              |
| [Security](security.md)                                  | `src/**`, `scripts/**`, `intelligence/**`, `ops/**`, `.github/workflows/**`, `package.json`, `.env*`                                                                                                          | Any code change: packages, input, secrets, access control, roles, the server.                 |
| [Payload CMS](payload-cms.md)                            | `src/**/cms/**`, `src/**/cms.ts`, `src/**/data/**`, `src/payload.config.ts`, `src/payload-types.ts`, `src/platform/payload/**`, `src/platform/richtext/**`, `src/migrations/**`, `src/endpoints/seed/**`      | You touch collections, blocks, heroes, hooks, fields, migrations or seed data.                |
| [Next.js and Tailwind](nextjs-tailwind.md)               | `src/app/**`, `src/**/*.tsx`, `src/**/*.css`, `src/themes/**`, `src/platform/theme/**`, `src/platform/seo/**`, `src/platform/lib/**`, `src/proxy.ts`, `next.config.*`                                         | You touch routes, metadata, caching, styling, design tokens, dates or images.                 |
| [Components and content](components-and-content.md)      | `src/**/*.tsx`, `src/platform/ui/**`, `src/platform/lib/messages/**`, `src/endpoints/seed/**`                                                                                                                 | You build UI or forms, or write site content or seed data.                                    |
| [UI/UX design](ui-ux-design.md)                          | `src/**/*.tsx`, `src/**/*.css`, `src/themes/**`, `src/platform/ui/**`, `src/platform/theme/**`                                                                                                                | You change how anything looks: hierarchy, spacing, color, accessibility.                      |
| [Images made for the site](images.md)                    | No, read by hand                                                                                                                                                                                              | You make, edit or publish an image, illustration or graphic for the site.                     |
| [Frontend patterns](frontend-patterns/README.md)         | No, read by hand                                                                                                                                                                                              | You need a tested snippet for a hero, section, card, CTA, motion or backdrop.                 |
| [Brand voice](brand-voice.md)                            | No, read by hand                                                                                                                                                                                              | You write anything a neighbor reads: messages, emails, posts, events, explainers.             |
| [Content marketing](content-marketing.md)                | No, read by hand                                                                                                                                                                                              | You plan, research or write blog posts and neighborhood news.                                 |
| [Social media](social-media.md)                          | No, read by hand                                                                                                                                                                                              | You plan or write posts and replies for Nextdoor, Facebook or other platforms.                |
| [Project facts](../project.md)                           | `src/**`, `scripts/**`, `intelligence/**`, `ops/**`, `e2e/**`, `.github/workflows/**`, `package.json`, `next.config.*`, `ecosystem.config.cjs`, `.env*`                                                       | Any code or server change: stack, hosting, environment variables, gotchas.                    |
| [How we work](../process/project-management.md)          | `docs/process/**`, `docs/product/**`, `.github/ISSUE_TEMPLATE/**`, `.github/label-policy.json`, `.agents/skills/change-workflow/**`, `.agents/skills/project-tracking/**`, `.github/pull_request_template.md` | You file, groom, pick up or report work, or open a pull request.                              |
| [Planning model](../process/planning-model.md)           | `docs/process/**`, `docs/product/**`, `.github/ISSUE_TEMPLATE/**`, `.agents/skills/project-tracking/**`, `.agents/skills/chief-of-staff/**`                                                                   | You choose a layer (milestone, epic, issue, sprint), name work, or write a milestone or epic. |
| [Grooming playbook](../process/grooming-playbook.md)     | `docs/process/**`, `docs/product/**`, `.github/ISSUE_TEMPLATE/**`, `.agents/skills/project-tracking/**`, `.agents/skills/chief-of-staff/**`                                                                   | You groom, sweep, move a card, or reorganize existing issues.                                 |
| [Watch list](../process/watch-list.md)                   | No, read by hand                                                                                                                                                                                              | You start a chief of staff session, run the sweep, or add a check or an alarm.                |
| [Issue and PR checks](../process/issue-and-pr-checks.md) | `.github/scripts/**`, `.github/workflows/issue-*.yml`, `.github/workflows/pr-policy.yml`, `docs/process/project-management.md`                                                                                | You change the issue check or the pull request gate, or read why one fired.                   |
| [Filing checklist](../process/filing-checklist.md)       | `.github/ISSUE_TEMPLATE/**`, `.github/pull_request_template.md`, `docs/process/filing-checklist.md`                                                                                                           | You file an issue or open a pull request.                                                     |

## Changing a guideline

Guidelines are policy. A change goes through the normal workflow, and the reviewer calls it out as a
policy change; one the owner didn't ask for waits for him ([`AGENTS.md`](../../AGENTS.md), step 3).
Keep each file under 250 lines and free of tool- or model-specific instructions; those belong in the
tool's adapter (today only Claude Code has one; see [Tool adapters](../../AGENTS.md#tool-adapters)).
