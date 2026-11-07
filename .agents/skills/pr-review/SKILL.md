---
name: pr-review
description: Independent review of a pull request in this repo before it merges — checks the linked issue, PR description, scope, correctness, security, and CI, then posts findings on the PR by severity. Use when asked to review a PR; never review a PR you authored.
---

# PR review

You are the independent reviewer required by [`AGENTS.md`](../../../AGENTS.md) step 3.
Review the change as someone who didn't write it. If you wrote any part of this PR, stop and
say so.

## 0. When Copilot's review agent can't review

If GitHub Copilot's review agent is out of credit, blocked or down, the PR still gets its
independent review, and every time (the owner's rule, 2026-11-06, Claude in Chrome side panel,
recorded on #779).

**How to tell** (the owner asked for a reliable check, #779 and #800). Judge by what happens, not by
what Copilot says. Request Copilot's review when the PR leaves draft, then wait. Copilot is available
only if a Copilot review exists on the PR's **current head** by the end of the wait (read
`gh api repos/{owner}/{repo}/pulls/<n>/reviews`; a wait of about ten minutes is enough). No review on
the current head after the wait means Copilot is out, whatever any message says or doesn't say.

- **Messages and usage are secondary evidence.** A comment saying Copilot couldn't review, or
  GitHub's premium-request usage report, may explain why. Neither overrides the outcome: a "can't
  review" message with no review is out, and silence with no review is out too. GitHub documents no
  such message, so never depend on its wording. The usage report has no remaining-allowance field
  and needs a token with the Plan user permission, which cloud sessions don't have.
- **A review with comments or an approval assessment is a real review.** Answer it as usual. If
  you can't tell whether one arrived, count Copilot as out.
- **Once out, stop waiting.** Later PRs in the same session go straight to the fallback below, and
  Copilot is requested again now and then, so a return is noticed rather than assumed away.
- **Record on the PR** which outcome decided it.

What to do then:

- **Start a new session for each PR.** Never the session that wrote the PR, and never one that already reviewed
  a different PR. In Claude Code that is a new subagent or a new session on the
  `sonnet` alias (the latest Sonnet) at `medium` effort, with the largest context, `sonnet[1m]`
  (1 million tokens), so the whole diff and the guidelines fit.
- **Run this whole skill.** It is the full review, not a skim: the process checks, the guard rails
  (2b), behavior changes (2c) and the change itself (3), against every guideline the diff touches.
- **Post it on the PR's current head** as step 4 says, and say in its first line that Copilot's
  review agent wasn't available and a fallback session reviewed it.
- A PR that raises the scrutiny level ([`CLAUDE.md`](../../../CLAUDE.md), models and effort) keeps
  its rule: `opus` at `high`.

## 1. Gather context

```bash
gh pr view <number> --json title,body,author,labels,files,closingIssuesReferences   # body is raw Markdown: read it as written
gh pr diff <number>
gh issue view <linked-issue-number>
gh pr checks <number>
gh api "repos/{owner}/{repo}/stacks?pull_request=<number>" -H 'X-GitHub-Api-Version: 2026-03-10'
```

## 2. Check the process (blockers if missing)

- [ ] The PR links an issue with a closing keyword. The issue describes the problem and has a
      type, an area, and a priority label.
- [ ] Every PR template section is filled in: What changed, Why, How, How to test,
      Risk & rollback, Knowledge.
- [ ] The diff matches the issue. No unrelated changes slipped in.
- [ ] The test steps are concrete enough for someone else to follow.
- [ ] **Dependent PRs are stacked.** If this PR needs another open PR, both are on a native
      GitHub stack ([`stacked-prs`](../stacked-prs/SKILL.md)): the base is the branch of the PR
      below, the description starts with the stack line, and nothing outside the stack is
      needed. A merge order written only in prose is a **Blocker**.
- [ ] **Policy changes are flagged.** If the diff touches `AGENTS.md`, `.agents/`,
      `.github/` (workflows, templates, label policy), `docs/guidelines/`, `docs/roles/`,
      `docs/knowledge/map.json` (it names the note for a path), `scripts/behavior-change.mjs` (the
      classifier of what the sync check enforces), or the
      Claude Code adapter (`CLAUDE.md`, `.claude/`), or changes how the team works in
      `docs/process/` (sprint length, Ready or Done, levels, the board's columns and fields, but
      not wording, link or fact fixes), list each such change under
      **Policy changes** in the review. Then check the owner asked for it. Agents file issues
      through his account, so an issue alone isn't proof: the issue or PR must record a short
      summary of what he decided, with the date and where he decided it. Check the change stays
      within that summary. If there is no summary, or the change goes beyond it, the verdict is
      **Waits for owner**. A PR can
      change the checks that run on itself, so read workflow changes carefully.

## 2b. Check the guard rails (blockers)

Read [`docs/guidelines/guard-rails.md`](../../../docs/guidelines/guard-rails.md). Check the diff
against each of rules 1–6 (rule 9 is step 2c), and the PR's **Self-review** section against the diff:

- [ ] **Reuse:** no copied logic, markup, class strings or constants; a number two files must agree
      on has one definition. Search the repo for what the diff adds.
- [ ] **UI kit:** no raw `<a>`, `<button>`, `<input>`, `<select>`, `<textarea>`, `<img>`, inline SVG
      or `<details>` outside the kit; no theme literals; shared components used, configured or
      split as [the rule](../../../docs/guidelines/components-and-content.md#shared-components-use-configure-or-split)
      says.
- [ ] **Architecture:** code in its module and layer; no module importing another.
- [ ] **Tests first:** new rules, guards, mappers and components have tests; a bug fix has its
      reproducing test.
- [ ] **Self-review:** present, specific for each item, and true of the diff.

Any breach is a **Blocker**. Never grade one as Minor, never accept it, never leave it to a
follow-up issue. A Self-review that claims what the diff doesn't show is a Blocker too.

## 2c. Check for behavior changes (every review, blockers)

Run this on every PR, also when the description says nothing changed. Definition of a behavior
change: [decision 0019](../../../docs/architecture/decisions/0019-knowledge-layer.md) §6.

1. List every behavior change in the diff: what a visitor, an editor or an agent would now see or
   get differently. Read the code, not the PR title. No change: say so in the review.
2. For each, find the sentence that now describes it: in the note the
   [map](../../../docs/knowledge/map.json) names for the changed path, or in the generated page in
   `docs/reference/`. For a path the map doesn't list, in the doc that describes it (a guideline,
   the setup notes, a skill). The check covers the whole repository (#770), so this applies to
   scripts, workflows, config and `ops/` too. Quote it in the review. Also judge what the check
   skipped (comment-only, formatting-only, tests, lockfile patches): a "formatting" diff that
   moves logic is a **Blocker**. A change with no matching sentence is a
   **Blocker**, except in a module with no note yet: say so, no Blocker.
3. Read the Knowledge section in the raw description (`gh pr view --json body`), not the rendered
   page. `Behavior change: none` needs a true reason as written. A reason hidden from readers (a
   Markdown link-reference comment such as `[//]: # (…)`, an HTML comment), a stock phrase, or a
   claim the diff contradicts is a **Blocker**. `yes` with no change to the note or doc that describes it is a **Blocker**.
4. A change to `docs/knowledge/map.json` is a behavior-change surface and a policy change: list it
   under **Policy changes**. Check every entry it adds points to a note that exists, and every
   entry it drops or narrows has a stated reason. Otherwise **Blocker**.
5. Run `npm run docs:check` for a change to a content type (routes and components once #718 lands).

## 3. Check the change

- **Correctness:** does it do what the issue asks? Look for edge cases, error handling,
  failure modes, and behavior when configuration is missing (local dev, CI).
- **Security:** no secrets or real personal data in the diff. Walk the change through each of
  these and note which apply:
  - Authentication and access rules: who can read or write, per operation, is unchanged or
    intentionally changed, on Payload collections, endpoints and routes alike.
  - Input is validated at every boundary (forms, query strings, uploads, webhooks, API bodies),
    and output built from user content is escaped or sanitized, never trusted as markup.
  - Secrets and personal data stay out of code, logs, error messages, fixtures and client bundles.
  - A new or upgraded dependency is established and maintained, and `Dependency Audit` stays green.
  - Server scripts, workflows and deploy steps run with the least permission and trust only
    their own repository's inputs.
  - Redirects, fetches of URLs and file paths built from input can't be steered to other targets.
    A finding in any of these is a **Blocker**. Treat code-scanning and secret-scanning alerts on
    the PR as findings to answer, not noise. For a change that touches sign-in, accounts, access
    rules, migrations, deploy or server scripts, the stronger reviewer model applies.
- **Native first, then plugins, then our code:** new custom code (a flow, a token, a limiter, a
  service) comes with the issue's findings for each step of the
  [ladder](../../../docs/guidelines/development.md#native-first-then-plugins-then-our-code):
  native Payload, Next.js and React, official plugins, open-source plugins. Check one or two
  claims yourself and use judgment, not a checklist. Findings missing, or a step that clearly
  fits: **Changes requested**. A technical trade-off is the author's to decide, with the reasoning
  on the issue. Only a genuine product trade-off, a meaningful cost, a legal or privacy
  commitment, or a decision established best practice can't reasonably resolve, that the owner
  hasn't decided, is **Waits for owner**.
- **Guidelines and architecture:** the change follows the guidelines for what it touches
  ([`docs/guidelines/`](../../../docs/guidelines/README.md)) and puts code where
  [`docs/architecture/`](../../../docs/architecture/README.md) says it goes. For code under
  `src/`, check it against [`write-code`](../write-code/SKILL.md): the right module and layer, no
  module importing another, no runtime Payload import outside `data/`, `cms/`, `platform/` and
  `payload.config.ts`, existing code and libraries reused instead of copied, tests for new rules,
  and files under 250 lines.
- **React and Next.js practice:** React and Next.js code follows the CRITICAL and HIGH rules of
  [`vercel-react-best-practices`](../vercel-react-best-practices/SKILL.md), and shared components
  follow [`vercel-composition-patterns`](../vercel-composition-patterns/SKILL.md). This repo's own
  rules come first where they differ (#424).
- **Tool-neutral guidance:** a new rule, procedure or fact lands in `AGENTS.md`, `docs/` or
  `.agents/skills/`, never only in the Claude Code adapter (`CLAUDE.md`, `.claude/`), where
  Codex wouldn't see it.
- **Configuration over code:** environment-specific values come from env vars, and new env
  vars are documented in `.env.local.example`.
- **Dependencies:** new packages are needed, maintained, and version-compatible. The lockfile
  is updated.
- **Data and deploy:** database migrations, `.env.local` changes on the server, and the
  rollback plan are all spelled out in the PR.
- **UI changes:** check visually at mobile and desktop widths, in both themes. Check
  accessibility (labels, contrast, focus).
- **`shared-component` label:** the change reaches every page that uses the changed code. Find
  those pages (grep the component or helper's imports) and check each one, not only the pages the
  PR names. Say in the review which pages you checked.

## 4. Post the review on the PR

Group findings by severity:

- **Blocker:** must fix before merge (broken behavior, security issue, missing process step)
- **Major:** should fix before merge
- **Minor:** fine to fix in a follow-up issue. Never a guard-rail breach: those are Blockers

List policy changes under their own **Policy changes** heading, with the summary of the owner's decision
that covers them, never his exact words. They are for visibility, not findings, so they don't count
against Ready to merge. List separately any safeguard agents added that goes beyond what he decided,
so he can drop it if he wants.

```bash
gh pr review <number> --comment --body-file review.md
```

For a specific line, add inline comments in the web UI or with `gh api`. Post the review on the PR's
current head, so its `commit_id` records the head you reviewed. A later head needs a new review
unless this one still counts ([`AGENTS.md`](../../../AGENTS.md) step 5).

End the review with a verdict. When a PR has findings to fix and also waits for the owner, the
verdict is **Changes requested**: it's fixed first, so he gets a clean PR.

- **Ready to merge:** no Blocker or Major left to fix, and every policy change is covered by the
  owner's recorded decision. The author then merges ([`change-workflow`](../change-workflow/SKILL.md),
  step 6).
- **Changes requested:** list them. The author fixes them and asks for a re-review.
- **Waits for owner:** the PR or its issue is labeled `needs owner`, it rests on a genuine product
  trade-off, a meaningful cost, a legal or privacy commitment, or a decision established best
  practice can't reasonably resolve, that the owner hasn't decided, or it changes policy he
  didn't ask for. The author labels the PR `needs owner`, asks him one plain question, and stops until he answers
  ([waits for owner](../../../docs/process/project-management.md#waits-for-owner)).
