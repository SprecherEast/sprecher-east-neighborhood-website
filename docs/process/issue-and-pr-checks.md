# The issue check and the pull request gate

The two automatic checks on how work is filed and shipped: what each rule is, its stable ID, and
what it does. They are described here, not in [how we work](project-management.md), to keep that
page short. Dependabot pull requests are exempt from the gate. The rules live in
`.github/scripts/` and run from `.github/workflows/`.

## The pull request gate

The `PR Policy` check (`.github/workflows/pr-policy.yml`, rules in `.github/scripts/pr-body.mjs`)
fails a pull request with one line per broken rule, each starting with a stable ID, so a failure
can be fixed in one try and counted ([#970](https://github.com/SprecherEast/sprecher-east-neighborhood-website/issues/970)).

| ID               | The rule                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `PR-CLOSES`      | The description closes exactly one issue with `Closes #N`; `Part of #N` does not count.    |
| `PR-LINKED`      | The link works both ways: the issue's timeline shows the pull request (a keyword does it). |
| `PR-LABELS`      | The issue has one type, at least one area and one priority label.                          |
| `PR-ASSIGNED`    | The issue is assigned: assigning claims it and moves its card to In progress.              |
| `PR-MILESTONE`   | The issue has a milestone (Backlog until planned). An epic is optional, so none is needed. |
| `PR-SECTIONS`    | Every template section is filled in.                                                       |
| `PR-SELF-REVIEW` | The self-review answers each item.                                                         |
| `PR-KNOWLEDGE`   | The knowledge note follows the behavior change, or the change is declared absent.          |
| `PR-E2E`         | An end-to-end exemption gives its reason.                                                  |

In a stack, only the bottom pull request targets `main` and GitHub reads a closing keyword only
there ([`stacked-prs`](../../.agents/skills/stacked-prs/SKILL.md#when-to-stack)), but GitHub runs
the default-branch checks for every pull request in the stack, and a mention still reaches the
issue's timeline, so each layer passes on its own with its own `Closes #N`.

## The issue check

When an issue is filed or changed, the `Issue Policy` workflow (`.github/workflows/issue-policy.yml`,
rules in `.github/scripts/issue-policy.mjs`,
[#969](https://github.com/SprecherEast/sprecher-east-neighborhood-website/issues/969)) checks it
against the [Definition of Ready](project-management.md#definition-of-ready). GitHub cannot stop an issue being filed, so it only warns:
one comment, kept up to date in place and never repeated, lists each failed rule with its ID and a
one-line fix, and the issue gets the `needs grooming` label. When everything passes, the label
goes and the comment says so. The check owns the label: it removes it from an issue that passes
and puts it back on one that still fails, so adding or removing it by hand changes nothing. An
issue with the label is not Ready. The check only warns today; making the pull request gate fail a
pull request whose issue still has the label is planned in
[#984](https://github.com/SprecherEast/sprecher-east-neighborhood-website/issues/984), and until
then that gate checks only the issue's labels, assignee and milestone (`PR-LABELS`,
`PR-ASSIGNED`, `PR-MILESTONE`), reading them the same way. It is stricter in one place: it asks
for exactly one priority label, where the gate accepts one or more. Pull requests, closed issues
and issues filed by a bot are not checked. An epic is exempt from every rule (a parent issue has
no files or checkboxes of its own), so one that was flagged before it became an epic loses the
label and its comment is marked clear on the next run.

Both gates and Issue Labels read a body without its HTML comments, as Markdown renders it. A
comment opener that is never closed hides everything after it, even inside a code span, so write
such text in a code block or leave the opener out; otherwise the later answers or sections count
as missing.

| ID                | The rule                                                                               |
| ----------------- | -------------------------------------------------------------------------------------- |
| `ISSUE-TYPE`      | Exactly one type label.                                                                |
| `ISSUE-AREA`      | At least one area label.                                                               |
| `ISSUE-PRIORITY`  | Exactly one priority label.                                                            |
| `ISSUE-SUMMARY`   | A plain-language summary section (the forms call it Problem).                          |
| `ISSUE-CRITERIA`  | Acceptance criteria with at least one checkbox that has text.                          |
| `ISSUE-FILES`     | "Files likely touched" and "Must not touch" filled in, or `None`.                      |
| `ISSUE-MILESTONE` | A milestone (Backlog until planned). An epic is optional, so there is no parent check. |
