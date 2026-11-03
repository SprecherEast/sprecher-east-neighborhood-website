---
name: pr-review
description: Independent review of a pull request in this repo before it merges — checks the linked issue, PR description, scope, correctness, security, and CI, then posts findings on the PR by severity. Use when asked to review a PR; never review a PR you authored.
---

# PR review

You are the independent reviewer required by [`AGENTS.md`](../../../AGENTS.md) step 3.
Review the change as someone who didn't write it. If you wrote any part of this PR, stop and
say so.

## 1. Gather context

```bash
gh pr view <number> --json title,body,author,labels,files,closingIssuesReferences
gh pr diff <number>
gh issue view <linked-issue-number>
gh pr checks <number>
gh api "repos/{owner}/{repo}/stacks?pull_request=<number>" -H 'X-GitHub-Api-Version: 2026-03-10'
```

## 2. Check the process (blockers if missing)

- [ ] The PR links an issue with a closing keyword. The issue describes the problem and has a
      type, an area, and a priority label.
- [ ] Every PR template section is filled in: What changed, Why, How, How to test,
      Risk & rollback.
- [ ] The diff matches the issue. No unrelated changes slipped in.
- [ ] The test steps are concrete enough for someone else to follow.
- [ ] **Dependent PRs are stacked.** If this PR needs another open PR, both are on a native
      GitHub stack ([`stacked-prs`](../stacked-prs/SKILL.md)): the base is the branch of the PR
      below, the description starts with the stack line, and nothing outside the stack is
      needed. A merge order written only in prose is a **Blocker**.
- [ ] **Policy changes are flagged.** If the diff touches `AGENTS.md`, `.agents/`,
      `.github/` (workflows, templates, label policy), `docs/guidelines/`, `docs/roles/`, or the
      Claude Code adapter (`CLAUDE.md`, `.claude/`), or changes how the team works in
      `docs/process/` (sprint length, Ready or Done, levels, the board's columns and fields, but
      not wording, link or fact fixes), list each such change under
      **Policy changes** in the review. Then check the owner asked for it. Agents file issues
      through his account, so an issue alone isn't proof: the issue or PR must quote his words,
      with the date and where he said them. Check the change stays within that quote. If there
      is no quote, or the change goes beyond it, the verdict is **Waits for owner**. A PR can
      change the checks that run on itself, so read workflow changes carefully.

## 2b. Check the guard rails (blockers)

Read [`docs/guidelines/guard-rails.md`](../../../docs/guidelines/guard-rails.md). Check the diff
against each of rules 1–6, and the PR's **Self-review** section against the diff:

- [ ] **Reuse:** no copied logic, markup, class strings or constants; a number two files must agree
      on has one definition. Search the repo for what the diff adds.
- [ ] **UI kit:** no raw `<a>`, `<button>`, `<input>`, `<select>`, `<textarea>`, `<img>`, inline SVG
      or `<details>` outside the kit; no theme literals.
- [ ] **Architecture:** code in its module and layer; no module importing another.
- [ ] **Tests first:** new rules, guards, mappers and components have tests; a bug fix has its
      reproducing test.
- [ ] **Self-review:** present, specific for each item, and true of the diff.

Any breach is a **Blocker**. Never grade one as Minor, never accept it, never leave it to a
follow-up issue. A Self-review that claims what the diff doesn't show is a Blocker too.

## 3. Check the change

- **Correctness:** does it do what the issue asks? Look for edge cases, error handling,
  failure modes, and behavior when configuration is missing (local dev, CI).
- **Security:** no secrets in the diff. Input is validated at boundaries. Access control on
  Payload collections and endpoints is unchanged or intentionally changed.
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

List policy changes under their own **Policy changes** heading, with the owner's quote that covers
them. They are for visibility, not findings, so they don't count against Ready to merge. List
separately any safeguard agents added that isn't in his words, so he can drop it if he wants.

```bash
gh pr review <number> --comment --body-file review.md
```

For a specific line, add inline comments in the web UI or with `gh api`. Post the review on the PR's
current head, so its `commit_id` records the head you reviewed. A later head needs a new review
unless this one still counts ([`AGENTS.md`](../../../AGENTS.md) step 5).

End the review with a verdict. When a PR has findings to fix and also waits for the owner, the
verdict is **Changes requested**: it's fixed first, so he gets a clean PR.

- **Ready to merge:** no Blocker or Major left to fix, and every policy change is covered by the
  owner's words. The author then merges ([`change-workflow`](../change-workflow/SKILL.md),
  step 6).
- **Changes requested:** list them. The author fixes them and asks for a re-review.
- **Waits for owner:** the PR or its issue is labeled `needs owner`, it rests on a genuine product
  trade-off, a meaningful cost, a legal or privacy commitment, or a decision established best
  practice can't reasonably resolve, that the owner hasn't decided, or it changes policy he
  didn't ask for. The author labels the PR `needs owner`, asks him one plain question, and stops until he answers
  ([waits for owner](../../../docs/process/project-management.md#waits-for-owner)).
