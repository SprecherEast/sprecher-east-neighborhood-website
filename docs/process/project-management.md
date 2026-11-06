# How we work: planning and tracking

How work is organized on GitHub: what each level means, how a sprint runs, what the board shows,
and when work is ready or done. It applies to every person and agent. How a change reaches `main`
is in [`AGENTS.md`](../../AGENTS.md). Where the work is heading is in the
[roadmap](../product/roadmap.md). The [`project-tracking`](../../.agents/skills/project-tracking/SKILL.md)
skill is the step-by-step version for agents.

GitHub is the only tracker for new work. Asana is being retired (#89: export #91, cutover #93).

Changing a rule here (how the team works: sprint length, Ready or Done, the levels, the board's
columns and fields) is a policy change, so the owner agrees first ([`AGENTS.md`](../../AGENTS.md),
step 3). Fixing wording, links or facts isn't.

## Levels of work

| Level         | Answers                                            | Size            | On GitHub                                        |
| ------------- | -------------------------------------------------- | --------------- | ------------------------------------------------ |
| Vision        | Why does the site exist?                           | years           | [`docs/product/vision.md`](../product/vision.md) |
| Milestone     | What outcome do we deliver, by when?               | 1–3 months (\*) | A milestone with a due date                      |
| Epic          | What capability is part of that outcome?           | weeks           | An issue labeled `epic`, with sub-issues         |
| Feature, task | What does a user get? What single change ships it? | a day or a few  | A sub-issue of an epic; one PR closes it         |
| Bug           | What's broken?                                     | S to L          | A sub-issue of the epic it belongs to            |

(\*) Guidance, not a rule.

Rules:

- **Every feature, task and bug belongs to an epic.**
- **Every planned epic belongs to a milestone.** Unscheduled epics wait in the backlog with no
  milestone, and so does foundation work done step by step alongside the milestones (#127).
- **A milestone groups the work for one outcome or context, with a due date,** such as "Ready for
  neighbors". Sprints are not milestones; they're the board's Sprint field.
- **One PR closes one issue** (`Closes #N`). When an issue needs several PRs, each uses
  `Part of #N` and the last one uses `Closes #N`.
- **Split ahead of time.** Split anything bigger than size L (3 days). An epic's features become
  sub-issues when they're planned, not all up front.

## Labels

The allowed labels are in [`.github/label-policy.json`](../../.github/label-policy.json):

- **Required on every issue:** exactly one type, at least one area, and one priority. The
  `PR Policy` check enforces this for linked issues.
- **Markers** (optional, with a fixed meaning):
  - `epic`: a parent issue whose sub-issues are the work.
  - `needs owner`: needs the owner's login or money, or his decision on a genuine product
    trade-off, a meaningful cost, a legal or privacy commitment, or a decision established best
    practice can't reasonably resolve. Agents can't do it. A choice between technically valid
    approaches isn't one: agents decide it and record why on the issue ([`AGENTS.md`](../../AGENTS.md#ground-rules)). Every
    `needs owner` issue is listed in the checklist of the owner-actions epic (#169); its parent
    stays the epic it belongs to. The issues that depend on it are marked **blocked by** it, so
    nobody starts them too early.
  - `shared-component`: a "watch out" flag on a PR that changes shared code many pages use:
    `src/platform/` (`ui/`, `richtext/`, `theme/`, `lib/`, `turnstile/`), `src/themes/`, the
    frontend layout and `globals.css`, and the site header, nav, footer and logo. The labeler sets
    it from the changed paths (#447); its reviewer checks every page that uses the changed code.

### Waits for owner

**Waits for owner** means: that issue or PR is on hold until the owner answers. Until then,
nobody decides for him, merges it, or starts anything marked blocked by it. Fixing review
findings on a waiting PR is fine, so he gets a clean one. Other work goes on, and silence is
never a yes.

When he answers, whoever acts on it records a short summary on the issue or PR (with the date and
where he gave it), then removes the `needs owner` label and carries on as he decided. He can also
merge or remove the label himself.

How to ask him ([`project-tracking`](../../.agents/skills/project-tracking/SKILL.md) step 5):
one plain question, the options in a sentence each, a recommendation, and what happens next.

Priority lives only in the `priority:` label. GitHub's issue types (Bug, Feature, Task) are
optional; the type label stays the required one because the `PR Policy` check reads labels.

## Sprints

- **One week**, Monday to Sunday, starting 2026-10-26. A sprint is the board's **Sprint** field.
- **Planning (Monday):** groom the backlog ([below](#grooming-and-one-task-at-a-time)), then pick
  **Ready** items, highest priority first, enough for the week. Leave room for bugs.
- **Review (end of the week):** the "Done last 7 days" view is the report of what shipped.
- **Retro (end of the week):** one thing to keep, one to change. A change becomes a rule (a PR to
  the right doc) or a task, never a loose note.

## The board

[GitHub Project #2 "Sprecher East"](https://github.com/users/boulaajaj/projects/2), owned by
`boulaajaj` and linked to this repo. It's private, so only the owner's account can open it. It was
built on 2026-10-21 from the spec in #90.

| Status      | Means                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------- |
| Backlog     | Captured, not ready yet.                                                                  |
| Ready       | Meets the Definition of Ready (below). Can go into a sprint.                              |
| In progress | Work has started (set before the first commit). Only one task at a time.                  |
| In review   | A PR that closes it is open, even as a draft. Linking the PR moves the issue here.        |
| Done        | Merged: the issue closes and the item moves here on its own. `wrapped` checks any deploy. |

- **Fields:** Status, Sprint, Size (S is under half a day, M is 1–2 days, L is up to 3 days),
  plus the built-in Labels, Milestone, Parent issue and Sub-issue progress.
- **Views:** This sprint (board), Backlog (everything not Done; each epic expands to its
  sub-issues), Roadmap (grouped by milestone, dated by Sprint), and Done last 7 days (issues closed
  as completed, `reason:completed`).
- **Automations:** new issues and PRs from this repo join in Backlog, and a sub-issue joins with its
  parent. Linking a PR moves an issue to In review. Merging its PR, or closing it for any reason
  (also as not planned), moves it to Done. Moving an item to Done by hand doesn't close the issue.
  Closed items are archived after two weeks.
- **Access:** changing the board needs the owner's account with the `project` scope: the owner in
  the web UI, or an agent on his computer signed in with `gh` and that scope. Agents in cloud
  sessions can't reach a board on a personal account, so they keep issue state, labels, parents
  and milestones right, say in a comment on the issue which card needs moving (and to which
  column), and let the board's automations do the rest. The next session on his computer moves it.

## Grooming and one task at a time

Summary of the owner's rule (2026-10-31, Claude Code session, text, recorded on #524): groom before
every major change, sorting tasks by effort and priority and moving them into Ready. Once everything is
in Ready, work one task at a time, setting each to In Progress, so the board always shows at a glance
what's being done and what isn't.

- **Groom before every major change:** a new epic, a sprint, or a batch of work. Each issue gets
  its plain summary, acceptance criteria, parent epic, labels (type, area, `priority:`) and a
  **Size**, which is effort: S, M or L (a cloud session that can't read the board skips Size and
  says so, as in the Definition of Ready). Anything bigger is split. When it meets the
  [Definition of Ready](#definition-of-ready), it moves to **Ready**.
- **Work in progress is limited to one task across the project,** whoever works on it. The next
  starts only when the current one is In review or Done. The highest-priority Ready item goes first.
- **In progress is set when work starts,** before the first commit, so the board shows it. In
  review and Done stay automatic.
- **Only a session on the owner's computer moves cards** (the Access note above). A cloud session
  says on the issue which card to move.

## Definition of Ready

An issue is **Ready** when it has:

- what and why, in plain language
- acceptance criteria someone else could check
- a parent epic, labels (type, area, priority) and a size. When the board can't be read (cloud
  sessions), skip Size and say so on the issue
  ([`project-tracking`](../../.agents/skills/project-tracking/SKILL.md) §1)
- no open blocker: nothing it's **blocked by** is still open
- no `needs owner` label: that work waits for the owner, not for a sprint

## Definition of Done

An issue is **Done** when:

- its PR has passed every required check and its independent review, and is merged
  ([`AGENTS.md`](../../AGENTS.md))
- if the merge started a deploy, the deploy succeeded and the changed behavior was checked on
  the live site (the [`wrapped`](../../.agents/skills/wrapped/SKILL.md) skill)
- the issue is closed with a summary of what changed. Server changes are recorded on the
  issue, without secrets.

## Reports

- **Weekly:** the "Done last 7 days" view, plus what's in progress and what's Ready next.
- **Milestone progress:** the share of its issues that are closed, shown on the milestone page.
- **Per sprint:** the board's burn-up chart (Insights).
- **What shipped in a period:** the issues closed between two dates, each with its closing summary.

## Delegating work

- An issue is the brief. Its acceptance criteria are the definition of done for whoever picks it
  up, person or agent.
- Before starting, read the issue's epic, milestone and sprint. If it isn't Ready, groom it into
  Ready first or pick another issue. Then set it In progress.
- New work found along the way becomes a new issue at the right level, with a parent. Don't widen
  the current PR to cover it.
