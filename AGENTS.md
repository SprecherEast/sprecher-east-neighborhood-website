# AGENTS.md — Sprecher East website

This file is the repository's own memory of **how work is done here**, and the entry point for
everyone who changes it: AI agents and humans. The supported agents are Claude Code (primary),
Codex, Gemini CLI and Grok Build ([Tool adapters](#tool-adapters)). Start here; it links to everything.

It does not depend on any tool's private memory. If a tool's memory, a chat instruction or
another doc conflicts with this file, **this file wins**. To change the rules, change this file
through the workflow below.

**Starting a session:** in Claude Code, unless given a specific task, you are the chief of staff:
follow its [skill](.agents/skills/chief-of-staff/SKILL.md). In another tool, work on the one
issue you are given ([how each tool starts](docs/process/start-a-session.md)).
**Before filing an issue or opening a PR** (even on one task), read the
[filing checklist](docs/process/filing-checklist.md).

## Ground rules

- **The name is "Sprecher East"**: never "SENA", "SE" or another abbreviation.
- **The site is unofficial and AI-assisted**, and says so. Content is factual and inclusive.
- **Anything a neighbor reads follows the [brand voice](docs/guidelines/brand-voice.md):** messages,
  emails, posts, events and explainers. Read it before you write one: the voice, the length limits,
  the neutral wording for money and politics, and the checks before publishing.
- **The repo is public.** Never commit secrets or real personal data
  ([security](docs/guidelines/security.md)).
- **Native first, then plugins, then our code.** Check what Payload, Next.js and React do natively,
  then official plugins, then well-established free open-source ones. Write custom code only when
  none fits, and record what each step found on the issue. It's a guide for judgment
  ([the ladder](docs/guidelines/development.md#native-first-then-plugins-then-our-code)).
- **Decide routine technical choices yourself** with engineering judgment and established practice:
  built-in features and mature, maintained libraries over custom code, reuse what exists, don't
  duplicate work underway, follow security, privacy, accessibility and usability standards, with
  fast, simple interactions on mobile first. Add tests, get the code reviewed, and record each
  decision briefly on its issue. Ask the owner only about genuine product trade-offs, meaningful
  costs, legal or privacy commitments, or decisions established best practice can't reasonably
  resolve. Several valid technical approaches are never a reason to wait for him (the owner's rule,
  2026-10-24, #315).
- **Test every finished flow as a resident would use it:** on a phone, with expired links,
  wrong input, and recovering from errors (#315).
- **Push back before building what's probably not the best way.** When the owner asks for something
  weaker than the standard approach (a security trade-off, say), don't build it as asked: explain
  the better option with sources, then stop until he has read it and decided (the owner's rule,
  2026-10-23, #305).

## Guard rails: non-negotiable

Build once and reuse everywhere; the UI kit instead of raw tags; theme tokens only; domain-driven,
clean architecture; tests first; the self-review before every PR; a breach is a Blocker. No one
can waive these, and "keep going" or "merge without waiting" never means skipping them. The full
rules, with the owner's direction and what enforces each, are in
[`docs/guidelines/guard-rails.md`](docs/guidelines/guard-rails.md). Read it before any change.

## The only way code reaches `main` and production

Merging to `main` deploys to production automatically (`.github/workflows/deploy.yml`). So every
change, however small, follows these five steps:

1. **Issue first,** created with a form in `.github/ISSUE_TEMPLATE/`, with the problem (or goal) and
   acceptance criteria. Labels, from `.github/label-policy.json` (the forms apply them):
   exactly one **type** (`bug`, `enhancement`, `documentation`, `tech-debt`, `process`), one or
   more **areas** (`frontend`, `cms`, `auth`, `ci`, `infra`, `dependencies`…), and one
   **priority** (`priority: high`, `priority: medium`, `priority: low`). The issue is groomed into
   **Ready** first, and set **In progress** when you start, one task at a time, or more when their
   files don't overlap ([how we work](docs/process/project-management.md#grooming-and-work-in-progress)).
2. **Branch and pull request.** Work on a branch, never on `main`; the PR closes one issue
   ([the rule](#one-issue-one-pull-request)) and fills in every section of
   `.github/pull_request_template.md` (**What changed**, **Why**, **How**, **How to test**,
   **Risk & rollback**, **Self-review**, **Knowledge**: did behavior change?).
3. **Review.** Every PR gets an **independent review** by a reviewer that did not write it (a
   separate agent session following [`pr-review`](.agents/skills/pr-review/SKILL.md), or a human),
   posted on the PR and ending with **Ready to merge**, and every review comment is answered and
   resolved. Without Copilot's review agent, a new session reviews each PR (`pr-review` step 0). Changes to the process are policy changes the review calls out explicitly:
   `AGENTS.md`, `.agents/`, `docs/guidelines/`, `docs/roles/`, `.github/`, the Claude Code adapter
   (`CLAUDE.md`, `.claude/`), and, in `docs/process/`, how the team works (sprint length, Ready or
   Done, the levels of work, the board's columns and fields), not wording, links or facts. A policy
   change the owner (Amine) asked for follows the normal path. Agents file issues through his
   account, so the issue or PR records a short summary of what he decided, with the date and where;
   the reviewer checks the change stays within it. A policy change an agent proposes on its own is
   labeled `needs owner` when it's filed, and waits for him.
4. **Everything green.** All required checks pass before merge: `Type-check & Build`, `Prettier`,
   `ESLint`, `Dependency Audit`, `PR Policy` (steps 1–2, and the knowledge note: decision 0019
   §6), `Knowledge sync` and `Agent context` (the session-start token budget, #737). Never bypass
   a failing or missing check. The deploy waits for the same set, except `PR Policy`, which runs on
   pull requests only. In a stack, every PR must be green on its own. Dependabot PRs are exempt from
   the issue and description rules only; they still need green checks and a review, and whoever
   picks one up (usually the ops lead) owns and merges it.
5. **Merge, then CI/CD takes over.** The agent that owns the PR squash-merges it once every required
   check passes on its current head, the review of that head says **Ready to merge**, and no
   conversation is open. A review of an earlier head still counts only when the head changed because
   a PR below it merged (or `main` moved) and the PR's own diff is unchanged; if a PR below changed
   after the review, this PR needs a new review even when its own diff didn't change; it can be
   short, checking it against what changed below. The owner doesn't need to be involved, but he
   can merge, hold or revert anything.
   A PR labeled `needs owner`, or whose issue is, waits for his answer. A stack merges one layer at
   a time from the bottom, waiting for each layer's checks on its rebased head and, if the merge
   started a deploy, for the deploy to succeed
   ([`change-workflow`](.agents/skills/change-workflow/SKILL.md), step 6). After the merge, the
   linked issue closes with a comment on how it was fixed
   (`.github/workflows/issue-fix-summary.yml`).

### One issue, one pull request

- **A PR closes exactly one issue** (`Closes #N`); bigger work splits into sub-issues.
- **Dependent PRs sit on a native GitHub stack,** so GitHub enforces the order
  ([`stacked-prs`](.agents/skills/stacked-prs/SKILL.md)); independent ones run in parallel.
- **Every issue has a milestone** (Backlog until planned). **An epic is optional,** for multi-part
  work; a lone issue has none. Its sub-issues sit under it.

### Never

- Never push to `main` directly, and never merge a PR whose checks or review aren't done.
- Never bypass a rule: no `--admin`, no `bypass_rules: true`, no other ruleset bypass, even when
  the account you're using has admin rights.
- Never remove `needs owner` from a question that is the owner's without his answer: first record
  its summary, with the date and where he gave it
  ([waits for owner](docs/process/project-management.md#waits-for-owner)).
- Never copy what the owner types or dictates word for word into issues, PRs, comments, reviews,
  commit messages, docs or code comments. Summarize it in clean wording.
- **Never change code on the server.** No editing files in `/var/www/sprecher-east`, no
  `git apply` or hotfixes over SSH. If production is broken, fix or revert through a PR.
- Never commit secrets (`.env.local`, keys, tokens, passwords).

**Server configuration is not code, but it is still tracked.** `.env.local`, the Caddy config, PM2,
DNS records and third-party dashboards (Mailgun, Porkbun, Hostinger) live only on the servers.
Before changing any of them, open an `infra` issue saying what will change, why, and how to roll it
back; afterwards, comment what actually changed. Never put secret values in the issue.

**How GitHub enforces this.** The `main` ruleset requires a pull request, the required checks in step 4
and resolved conversations, and blocks force pushes and deletion.
Agents work through the owner's account, which has admin rights, so until they have their own
GitHub identity (#106) the no-bypass rule rests on every agent merging with `bypass_rules: false`.

## Skills: how to do things

Procedures are [Agent Skills](https://agentskills.io): a folder in `.agents/skills/` with a
`SKILL.md` that starts with a `name` and a `description`. Codex loads them from there, Claude Code
through the pointers in `.claude/skills/`, and a human reads them as plain Markdown.

| Skill                                                                  | Use it when                                                                |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`change-workflow`](.agents/skills/change-workflow/SKILL.md)           | Before any change: issue, branch, PR, review, checks, merge.               |
| [`stacked-prs`](.agents/skills/stacked-prs/SKILL.md)                   | A PR depends on another open PR, or a PR in a stack has to change.         |
| [`write-code`](.agents/skills/write-code/SKILL.md)                     | Writing, moving or reviewing code: where it goes, reuse, tests, the rules. |
| [`self-review`](.agents/skills/self-review/SKILL.md)                   | A change is done: review your own diff before opening or updating the PR.  |
| [`visual-design-review`](.agents/skills/visual-design-review/SKILL.md) | The change affects how pages look, or you make an image for the site.      |
| [`pr-review`](.agents/skills/pr-review/SKILL.md)                       | You are the independent reviewer of a PR you didn't write.                 |
| [`wrapped`](.agents/skills/wrapped/SKILL.md)                           | After a merge: verify it, check the deploy, close the loop, report.        |
| [`project-tracking`](.agents/skills/project-tracking/SKILL.md)         | Picking up, filing or reporting work: epics, milestones, sprint, blockers. |
| [`chief-of-staff`](.agents/skills/chief-of-staff/SKILL.md)             | You are the chief of staff: open questions, grooming, overlap, briefs.     |

Two skills come from Vercel, unchanged (MIT, source in each `SOURCE.md`, #424):
[`vercel-react-best-practices`](.agents/skills/vercel-react-best-practices/SKILL.md) for React and
Next.js performance, and [`vercel-composition-patterns`](.agents/skills/vercel-composition-patterns/SKILL.md)
for component APIs. `write-code` and the reviews apply them; this repo's own rules come first
where they differ.

## Where knowledge lives

Durable knowledge lives in this repository and changes through the workflow above, never in a
tool's private memory, a chat, or loose notes. Write it for any agent and any human (no
tool-specific commands or model names), and keep each file under 250 lines.

- A rule everyone follows on every change: this file.
- How a module or the content types work: [`docs/knowledge/index.md`](docs/knowledge/index.md), one
  line per note, each next to its code (`src/modules/<name>/README.md`), plus the generated
  `docs/reference/`. Read the note before changing a module. **A behavior change and the note that
  describes it change in the same PR** ([0019](docs/architecture/decisions/0019-knowledge-layer.md) §6).
- Why the site exists and what comes next: [`docs/product/`](docs/product/vision.md).
- How work is planned and tracked, and how the agent team works:
  [`docs/process/`](docs/process/project-management.md).
- A convention: a guideline in [`docs/guidelines/`](docs/guidelines/README.md). A procedure: a skill.
  What a role checks: its guide in [`docs/roles/`](docs/roles/README.md).
- A fact about the system: [`docs/project.md`](docs/project.md) (stack, hosting, gotchas),
  [`docs/architecture/`](docs/architecture/README.md) (where code goes, data model; read it before
  coding), `ops/README.md` (server scripts). The reason behind a decision: a record in `docs/architecture/decisions/`.

**Before you change files, read the references the table in
[`docs/guidelines/README.md`](docs/guidelines/README.md) names for them.** Claude Code loads them
by itself when it opens a matching file; any other agent or person reads them by hand.

## Tool adapters

The other tools load this file themselves (Gemini via a one-line `GEMINI.md`, [start a
session](docs/process/start-a-session.md)). Claude Code adds a thin adapter: `CLAUDE.md`, importing
this file and the guard rails, and `.claude/`: a pointer to each skill, the subagents, and the rules that load a reference when the work touches its files,
generated from that table. An adapter holds only what is specific to its tool. Never put a rule,
procedure or fact only in an adapter: the other tools wouldn't see it.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
