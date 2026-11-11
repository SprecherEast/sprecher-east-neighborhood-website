<!--
Every PR closes exactly one issue and fills in every section below. The "PR Policy" check enforces
this and names each failure by rule ID (PR-CLOSES, PR-LINKED, PR-LABELS, PR-ASSIGNED, PR-MILESTONE,
PR-GROOMED, PR-SECTIONS, PR-SELF-REVIEW, PR-KNOWLEDGE, PR-E2E): docs/process/issue-and-pr-checks.md#the-pull-request-gate
Before opening: read docs/process/filing-checklist.md (one line per rule ID, with its fix)
Rules: AGENTS.md. Procedure: .agents/skills/change-workflow/SKILL.md
If this PR depends on another open PR, put both on a native GitHub stack and start this
description with the stack line: .agents/skills/stacked-prs/SKILL.md
-->

Closes #

## What changed

<!-- The concrete changes, file by file or area by area. -->

## Why

<!-- The problem from the linked issue, and why this is the right fix. -->

## How

<!-- The approach: key decisions, alternatives considered, anything a reviewer should know.
New custom code: link the issue comment with what each step of the ladder found
(docs/guidelines/development.md#native-first-then-plugins-then-our-code). -->

## How to test

<!-- Numbered steps someone else can follow, with the expected result for each. -->

1.

<!-- Browser tests (#868): CI runs "End-to-end tests" when this PR changes the UI (the UI kit, styles
or theme, pages and layouts, a module's ui/ folder; comment-only and formatting-only edits, tests
and docs don't count). If they truly are not needed, replace "none" with the reason, 20+ characters;
the reviewer checks it against the diff. Write "run" to ask for the tests on any PR. -->

End-to-end exemption: none

## Risk & rollback

<!-- What could break, server/env changes needed (no secret values), and how to undo it. -->

## Self-review

<!-- Required (docs/guidelines/guard-rails.md, rule 6). Run the self-review skill on the final diff.
For each, what you checked and what you fixed; "not applicable, because ..." only where it truly is.
- Reuse: searched for existing code; nothing copied; shared things defined once
- Quality: no raw tags the UI kit covers, no magic numbers, architecture layers respected, tests first
- Efficiency:
- Guidelines: theme tokens only, security, development rules
- Visual: screenshots at the six widths, light and dark (UI changes) -->

- Reuse:
- Quality:
- Efficiency:
- Guidelines:
- Visual:

## Knowledge

<!-- Decision 0019 section 6. Behavior change = anything a visitor, an editor or an agent would see
or get differently (a screen, a message, fields, access, a route, an email, a job, a limit).
Not one: a refactor that keeps behavior, tests, comments, formatting.
If this PR changes anything that can alter behavior, anywhere (tests, comments, formatting, docs
and lockfile patches don't count), change the note, guideline or reference that describes it in
the same PR (and the note docs/knowledge/map.json names for that code), or write
"Behavior change: none" and why (20+ characters). A doc you name by path here must be in the diff.
The reviewer checks it against the diff. How to decide: docs/guidelines/development.md#documentation-follows-behavior -->

Behavior change:

## Checklist

- [ ] The closed issue has a type, an area, a priority label, an assignee and a milestone
- [ ] `npx tsc --noEmit`, ESLint and Prettier pass locally
- [ ] Self-review done and recorded above, and every finding fixed
- [ ] Independent review requested (`.agents/skills/pr-review/SKILL.md`)
- [ ] No secrets committed, and no code changed directly on the server
