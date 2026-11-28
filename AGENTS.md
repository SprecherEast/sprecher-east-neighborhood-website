# AGENTS.md — Sprecher East website

This file is the repository's own memory of **how work is done here**, and the entry point for
everyone who changes it: AI agents and humans. The supported agents are Claude Code (primary),
Codex, Gemini CLI and Grok Build ([tool adapters](docs/guidelines/where-knowledge-lives.md#tool-adapters)). Start here; it links to everything.

It does not depend on any tool's private memory. If a tool's memory, a chat instruction or
another doc conflicts with it, **this file wins**; change the rules through the workflow below.

**Starting a session:** in Claude Code, unless given a task, you are the chief of staff: follow its
[skill](.agents/skills/chief-of-staff/SKILL.md). In another tool, work on the one issue you are
given ([how each tool starts](docs/process/start-a-session.md)).
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
clean architecture; tests first; the self-review before every PR; a behavior change updates the note that
describes it in the same PR, or the PR declares none with a true reason; a breach is a Blocker. No one
can waive these. The full rules, with what enforces each, are in
[`docs/guidelines/guard-rails.md`](docs/guidelines/guard-rails.md): read it before changing code.

## The path to `main`

Merging to `main` deploys to production. Every change has an issue first, a branch and one pull
request, an independent review, every required check green, then the merge. The rules and the
procedure are in [`change-workflow`](.agents/skills/change-workflow/SKILL.md): open it before you
file, branch, review or merge. A change to a rule, guideline, skill, role guide or adapter is a
policy change: one the owner didn't ask for is labeled `needs owner` and waits for him.

### One issue, one pull request

A PR closes exactly one issue (`Closes #N`); bigger work splits into sub-issues. Dependent PRs sit
on a native GitHub stack ([`stacked-prs`](.agents/skills/stacked-prs/SKILL.md)).

### Never

- Never push to `main`, and never merge a PR whose checks or review aren't done.
- Never bypass a rule or a ruleset, even when your account has the right to
  (the Bash hook and the `main` ruleset refuse the known ways).
- Never remove `needs owner` from a question that is the owner's without his answer: first record
  its summary, with the date and where he gave it
  ([waits for owner](docs/process/waits-for-owner.md)).
- Never copy what the owner types or dictates word for word into issues, PRs, comments, reviews,
  commit messages, docs or code comments. Summarize it in clean wording.
- **Never change code on the server.** If production is broken, fix or revert through a PR.
- Never commit secrets.

## Where things live

- **Procedures are skills** in `.agents/skills/`; open the one whose description matches the work.
- **Before you change files,** read the references the table in
  [`docs/guidelines/README.md`](docs/guidelines/README.md) names for them. Claude Code loads them
  by itself when it opens a matching file; any other agent or person reads them by hand.
- **Module notes** are listed in [`docs/knowledge/index.md`](docs/knowledge/index.md); read the note
  before changing a module.
- **Durable knowledge lives in this repository,** never in a tool's private memory: see
  [where knowledge lives](docs/guidelines/where-knowledge-lives.md). Never put a rule, procedure
  or fact only in a tool's adapter: the other tools wouldn't see it.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
