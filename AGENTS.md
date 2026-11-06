# AGENTS.md — Sprecher East website

This file is the repository's own memory of **how work is done here**, and the entry point for
everyone who changes it: AI agents and humans. The supported agents are Claude Code (primary) and
Codex ([Tool adapters](#tool-adapters)). Start here; it links to everything else.

It does not depend on any tool's private memory. If a tool's memory, a chat instruction, or
another doc in this repo conflicts with this file, **this file wins**. To change the rules,
change this file through the same workflow below.

## Ground rules

- **The name is "Sprecher East"**: never "SENA", "SE" or another abbreviation.
- **The site is unofficial and AI-assisted**, and says so. Content is factual and inclusive.
- **Anything a neighbor reads follows the [brand voice](docs/guidelines/brand-voice.md):** messages,
  emails, posts, events and explainers. Read it before you write one. It sets the voice, the length
  limits, the neutral wording for money and politics, and the checks before publishing.
- **The repo is public.** Never commit secrets or real personal data (see
  [security](docs/guidelines/security.md)).
- **Native first, then plugins, then our code.** Before building a feature, check what Payload,
  Next.js and React do natively, then official plugins, then well-established free open-source
  ones. Write custom code only when none fits, and record what each step found on the issue.
  It's a guide for judgment
  ([the ladder](docs/guidelines/development.md#native-first-then-plugins-then-our-code)).
- **Decide routine technical choices yourself.** Use engineering judgment and established
  practice: built-in features and mature, maintained libraries over custom code, reuse what
  exists, don't duplicate work already underway, and follow security, privacy, accessibility
  and usability standards, with fast, simple interactions on mobile first. Add tests and get
  the code reviewed. Record each decision briefly on its issue. Ask the owner only about genuine
  product trade-offs, meaningful costs, legal or privacy commitments, or decisions established
  best practice can't reasonably resolve. Several valid technical approaches are never a reason
  to wait for him (the owner's rule, 2026-10-24, recorded on #315).
- **Test every finished flow as a resident would use it:** on a phone, with expired links,
  wrong input, and recovering from errors (#315).
- **Push back before building what's probably not the best way.** When the owner asks for
  something that looks weaker than the standard approach (for example a security trade-off),
  don't build it as asked. Explain the better option with sources, then stop and wait until he
  has read it and decided. Building first wastes work on a change that may be thrown away (the
  owner's rule, 2026-10-23, recorded on #305). This and the rule above fit together: push back
  when his request is weaker than the standard; decide routine things yourself.

## Guard rails: non-negotiable

Build once and reuse everywhere; the UI kit instead of raw tags; theme tokens only; domain-driven,
clean architecture; tests first; the self-review before every PR; a breach is a Blocker. No one
can waive these, and "keep going" or "merge without waiting" never means skipping them. The full
rules, with a summary of the owner's direction and what enforces each, are in
[`docs/guidelines/guard-rails.md`](docs/guidelines/guard-rails.md). Read it before any change.

## The only way code reaches `main` and production

Merging code changes to `main` deploys them to production automatically
(`.github/workflows/deploy.yml`). So every change, however small, follows these five steps:

1. **Issue first.** Start from a GitHub issue created with one of the issue forms in
   `.github/ISSUE_TEMPLATE/`. It describes the problem (or goal) and acceptance criteria.
   Labels:
   - exactly one **type**: `bug`, `enhancement`, `documentation`, `tech-debt`, or `process`
   - one or more **areas**, such as `frontend`, `cms`, `auth`, `ci`, `infra`, or `dependencies`
   - one **priority**: `priority: high`, `priority: medium`, or `priority: low`

   The issue forms apply these automatically (`.github/workflows/issue-labels.yml`). The
   allowed values live in one place: `.github/label-policy.json`.

   The issue is groomed into **Ready** first, and set **In progress** when you start, one task at
   a time ([how we work](docs/process/project-management.md#grooming-and-one-task-at-a-time)).

2. **Branch and pull request.** Work on a branch, never on `main`. Open a PR that:
   - links the issue with a closing keyword (`Closes #123`), or with `Part of #123` when an
     issue needs several PRs (the last one uses `Closes`)
   - fills in every section of `.github/pull_request_template.md`: **What changed**,
     **Why**, **How**, **How to test**, **Risk & rollback**, **Self-review**
   - **sits on a native GitHub stack when it depends on another open PR**: its base is the
     branch of the PR below, and the PRs are joined in a stack so GitHub enforces the order they
     merge in. A merge order written in a description or a message is never enough
     ([`stacked-prs`](.agents/skills/stacked-prs/SKILL.md)).

3. **Review.** Every PR is reviewed before merge:
   - an **independent review** by a reviewer that did not write the change (a separate agent
     session following [`pr-review`](.agents/skills/pr-review/SKILL.md), or a human), posted
     on the PR, ending with the verdict **Ready to merge**
   - every review comment answered and its conversation resolved

   Changes to the process itself are policy changes, and the review must call them out
   explicitly. That covers `AGENTS.md`, `.agents/`, `docs/guidelines/`, `docs/roles/`,
   `.github/`, and the Claude Code adapter (`CLAUDE.md`, `.claude/`). In `docs/process/`, it
   covers changes to how the team works, such as sprint length, what Ready or Done means, the
   levels of work, or the board's columns and fields; fixing wording, links or facts there isn't
   a policy change. A policy change the owner (Amine) asked for follows the normal path. Agents
   file issues through his account, so an issue alone doesn't show he asked: the issue or PR
   records a short summary of what he decided, with the date and where he decided it, and the
   reviewer checks the change stays within that summary. A policy change an agent proposes on its own is labeled
   `needs owner` when it's filed, and waits for him.

4. **Everything green.** All required checks pass before merge: `Type-check & Build`,
   `Prettier`, `ESLint`, `Dependency Audit`, and `PR Policy` (which verifies steps 1–2).
   Never bypass a failing or missing check. In a stack, every PR must be green on its own.

   Dependabot PRs are exempt from the issue and description rules only. They still need green
   checks and a review before they merge. Whoever picks one up (usually the ops lead) owns it and
   merges it.

5. **Merge, then CI/CD takes over.** The agent that owns the PR merges it (squash merge) once steps
   3 and 4 are done: every required check passes on the PR's current head, the review of that head
   says **Ready to merge**, and no conversation is open. A review of an earlier head still counts
   only when the head changed because a PR below it merged (or `main` moved) and the PR's own diff
   is unchanged. If a PR below changed after the review, this PR needs a new review even when its
   own diff didn't change; it can be short, checking this PR against what changed below. The owner
   doesn't need to be involved, but he can merge, hold or revert anything himself. A PR labeled
   `needs owner`, or one whose issue is, waits for him until he answers. A stack
   merges one layer at a time from the bottom. Before the next layer, wait for its checks on its
   rebased head and, if the merge started a deploy, for the deploy to succeed
   ([`change-workflow`](.agents/skills/change-workflow/SKILL.md), step 6). The deploy workflow ships
   `main` to the VPS. After the merge, the linked issue is closed and gets a comment summarizing how
   it was fixed (`.github/workflows/issue-fix-summary.yml`).

### Never

- Never push to `main` directly, and never merge a PR whose checks or review aren't done.
- Never bypass a rule: no `--admin`, no `bypass_rules: true`, no other ruleset bypass, even when
  the account you're using has admin rights.
- Never remove the `needs owner` label without the owner's answer: record a summary of it on the
  issue or PR, with the date and where he gave it, first
  ([waits for owner](docs/process/project-management.md#waits-for-owner)).
- Never copy what the owner types or dictates word for word into issues, PRs, comments, reviews,
  commit messages, docs or code comments. Summarize it in clean wording.
- **Never change code on the server.** No editing files in `/var/www/sprecher-east`, no
  `git apply` or hotfixes over SSH. If production is broken, fix or revert through a PR.
- Never commit secrets (`.env.local`, keys, tokens, passwords).
- Never hand over dependent PRs as separate PRs with a merge order in prose. Stack them.

### Server configuration is not code — but it is still tracked

Some things live only on the servers: `.env.local`, the Caddy config, PM2, DNS records, and
third-party dashboards (Mailgun, Porkbun, Hostinger). Before changing any of them, open an issue
labeled `infra`. Say what will change and why, and how to roll it back. Afterwards, comment
on that issue with what was actually changed. Never put secret values in the issue.

### How GitHub enforces this

The `main` ruleset requires a pull request, the five checks above, and resolved conversations.
It also blocks force pushes and deletion. Stacks enforce the merge order of dependent PRs.
Agents currently work through the owner's GitHub account, which has admin rights, so GitHub
can't technically stop an agent from bypassing the ruleset. Until agents have their own GitHub
identity (#106), the no-bypass rule depends on every agent following this file and merging with
rules enforced (`bypass_rules: false`).

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
| [`visual-design-review`](.agents/skills/visual-design-review/SKILL.md) | The change affects how pages look.                                         |
| [`pr-review`](.agents/skills/pr-review/SKILL.md)                       | You are the independent reviewer of a PR you didn't write.                 |
| [`wrapped`](.agents/skills/wrapped/SKILL.md)                           | After a merge: verify it, check the deploy, close the loop, report.        |
| [`project-tracking`](.agents/skills/project-tracking/SKILL.md)         | Picking up, filing or reporting work: epics, milestones, sprint, blockers. |

Two skills come from Vercel, unchanged (MIT, source in each `SOURCE.md`, #424):
[`vercel-react-best-practices`](.agents/skills/vercel-react-best-practices/SKILL.md) for React and
Next.js performance, and
[`vercel-composition-patterns`](.agents/skills/vercel-composition-patterns/SKILL.md) for component
APIs. `write-code` and the reviews apply them; this repo's own rules come first where they differ.

## References: what is true here

| Doc                                                   | What's in it                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`docs/product/`](docs/product/vision.md)             | Why the site exists, who it serves, what's out of scope, and the roadmap of milestones and epics.     |
| [`docs/process/`](docs/process/project-management.md) | How work is planned and tracked: epics, milestones, sprints, the board, Ready and Done.               |
| [`docs/project.md`](docs/project.md)                  | The system: stack, hosting, environment variables, local setup, known gotchas.                        |
| [`docs/architecture/`](docs/architecture/README.md)   | Where code goes, dependency rules, naming, data model, decisions. Read before coding.                 |
| [`docs/guidelines/`](docs/guidelines/README.md)       | Conventions by topic: development, security, Payload, Next.js and Tailwind, UI/UX, patterns, content. |
| [`docs/roles/`](docs/roles/README.md)                 | Role guides (backend, CMS, frontend, UI, UX, content, events, media, SEO, legal, ops, QA).            |
| [`ops/README.md`](ops/README.md)                      | Server scripts: deploy steps, backups and restore, Caddy limits.                                      |

## Where knowledge lives

Durable knowledge about this project lives in this repository and changes through the workflow
above. Not in a tool's private memory, a chat, or loose notes.

- Why the site exists and what comes next go in `docs/product/` (vision and roadmap).
- How work is planned and tracked goes in `docs/process/`.
- A rule everyone follows on every change goes in this file.
- A convention goes in a guideline in `docs/guidelines/`.
- A procedure goes in a skill in `.agents/skills/`.
- What a role focuses on and checks goes in its role guide in `docs/roles/`.
- A fact about the system goes in `docs/project.md` or `docs/architecture/`; the reason behind a
  decision goes in a decision record (`docs/architecture/decisions/`).

Write all of these for any agent and any human: no tool-specific commands or model names. Keep
each file under 250 lines.

## Tool adapters

The repo supports two agents: **Claude Code**, the primary one, and **Codex**. Other tools aren't
supported, and the repo doesn't keep a file for each tool.

- **Codex** reads this file and `.agents/skills/` itself. It needs nothing else.
- **Claude Code** needs a thin adapter: `CLAUDE.md`, which imports this file and the core
  references, and `.claude/`. `.claude/` holds a pointer to each skill in `.agents/skills/`
  (`simplify` is Claude Code's name for `self-review`), plus the subagents for the role guides.

An adapter holds only what is specific to its tool. Never put a rule, procedure or fact only in an
adapter: Codex wouldn't see it.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
