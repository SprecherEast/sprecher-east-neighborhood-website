# How we work: planning and tracking

How work is organized on GitHub: what each level means, how a sprint runs, what the board shows,
and when work is ready or done. It applies to every person and agent. How a change reaches `main`
is in [`AGENTS.md`](../../AGENTS.md). Where the work is heading is in the
[roadmap](../product/roadmap.md). The [`project-tracking`](../../.agents/skills/project-tracking/SKILL.md)
skill is the step-by-step version for agents.

How the agent team (chief of staff, workers, reviewers) works on top of this is in the
[agent operating model](agent-operating-model.md). Which layer a piece of work belongs at, and how
to name it, is in the [planning model](planning-model.md); when to groom, what each board move
requires and how the sweep works is in the [grooming playbook](grooming-playbook.md).

GitHub is the only tracker for new work.

Changing a rule here (how the team works: sprint length, Ready or Done, the levels, the board's
columns and fields) is a policy change, so the owner agrees first ([`AGENTS.md`](../../AGENTS.md),
step 3). Fixing wording, links or facts isn't.

## Levels of work

| Level         | Answers                                            | Size                   | On GitHub                                        |
| ------------- | -------------------------------------------------- | ---------------------- | ------------------------------------------------ |
| Vision        | Why does the site exist?                           | years                  | [`docs/product/vision.md`](../product/vision.md) |
| Milestone     | What outcome is done, and how do we know?          | several capabilities   | A milestone; a due date only for a real date     |
| Epic          | What capability is part of that outcome?           | several related issues | An issue labeled `epic`, with sub-issues         |
| Feature, task | What does a user get? What single change ships it? | a day or a few         | A sub-issue of an epic; one PR closes it         |
| Bug           | What's broken?                                     | S to L                 | A sub-issue of the epic it belongs to            |

Rules:

- **Every feature, task and bug sits under an epic and in a milestone**
  ([the rule](../../AGENTS.md#one-issue-one-pull-request)).
- **Every epic belongs to a milestone.** Unscheduled epics, and foundation work done step by step
  alongside the milestones (#127), sit in the catch-all Backlog milestone until they're planned.
- **A milestone is an outcome with a done test** (the Backlog milestone is the one exception,
  [planning model](planning-model.md#milestone)), one per issue, and has a due date only when a
  real date exists (a date the owner decides counts). Sprints are not milestones; they're the board's Sprint field.
- **One PR closes one issue** ([the rule](../../AGENTS.md#one-issue-one-pull-request)).
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
  - `scope-creep`: work found while doing another issue. It gets its own issue, linked to the
    original with a `[SCOPE]` comment, and the original PR does not widen.
  - `proposed-close`: an agent thinks the issue is obsolete, or duplicates another idea. It waits
    for the owner; an agent never closes an old idea by itself. (Duplicate bugs are the exception
    set out in the [agent operating model](agent-operating-model.md#4-how-an-issue-moves).)
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

Priority lives only in the `priority:` label. (This and the board section below describe the setup before the repository moved to an organization; the [planning model](planning-model.md#githubs-model-compared-with-jiras) says what applies now, and a later change updates this page.) GitHub's issue types (Bug, Feature, Task) are
optional; the type label stays the required one because the `PR Policy` check reads labels.

## Sprints

- **One week**, Monday to Sunday, starting 2026-10-26. A sprint is the board's **Sprint** field.
- **Planning (Monday):** groom the backlog ([below](#grooming-and-work-in-progress)), then pick
  **Ready** items, highest priority first, enough for the week. Leave room for bugs.
- **Review (end of the week):** the "Done last 7 days" view is the report of what shipped.
- **Retro (end of the week):** one thing to keep, one to change. A change becomes a rule (a PR to
  the right doc) or a task, never a loose note.

## The board

[GitHub Project #1 "Sprecher East"](https://github.com/orgs/SprecherEast/projects/1), owned by
the `SprecherEast` organization and linked to this repo. It's private to the organization. It was
built on 2026-10-21 from the spec in #90 and moved to the organization after.

| Status      | Means                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------- |
| Backlog     | Captured, not ready yet.                                                                  |
| Ready       | Meets the Definition of Ready (below). Can go into a sprint.                              |
| In progress | Work has started (set before the first commit). More than one only with no shared files.  |
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
  the web UI, or an agent on his computer signed in with `gh` and that scope. A cloud session's GitHub access
  can be read-only: an error such as "Resource not accessible by integration" means the Claude
  GitHub app is probably not installed on the organization (not confirmed). The planner app is the
  route to the board that does not need anyone's computer. A cloud session that can write issues keeps
  issue state, labels, parents and milestones right and never needs the board: assigning an issue
  is how work is claimed, and the planner app then moves the card (below).
- **The planner app:** a GitHub App owned by the organization can read and change the board without
  anyone's computer, signing in with a short-lived token made from a key kept only as a repository
  secret. The `Planner App Check` workflow, run by hand, proves it can read the board and write to
  one throwaway issue and its card. One rule guards sprint history: work that finished in a sprint
  keeps that sprint, and only unfinished work moves forward (GitHub has no setting that locks it,
  so the app's code enforces it). The `Planner Board` workflow runs as the app on a native signal,
  not on comments: a new or reopened issue joins the sprint that is running, and an assigned issue
  also becomes In progress. A card never moves backwards, and it can be run by hand for one issue.

## Grooming and work in progress

Summary of the owner's rule (2026-10-31, Claude Code session, text, recorded on #524): groom before
every major change, sorting tasks by effort and priority and moving them into Ready. Once everything is
in Ready, work one task at a time, setting each to In Progress, so the board always shows at a glance
what's being done and what isn't. On 2026-11-04 (voice and text sessions, recorded on #685) he allowed
parallel work when issues don't touch the same files, with no fixed number, and confirmed it on
2026-11-06 (Claude session, text, recorded on #685 and #721); the rule below says how.

- **Groom before every major change:** a new epic, a sprint, or a batch of work. Each issue gets
  its plain summary, acceptance criteria, parent epic, labels (type, area, `priority:`) and a
  **Size**, which is effort: S, M or L (a cloud session that can't read the board skips Size and
  says so, as in the Definition of Ready). Anything bigger is split. When it meets the
  [Definition of Ready](#definition-of-ready), it moves to **Ready**.
- **Work in progress has no fixed number.** What limits it is whether issues touch the same
  files (#721). Past
  the first, an issue starts only if its **Files likely touched** don't overlap with those of any
  issue in progress, the two don't both touch the **shared hot spots**, and it isn't blocked by
  any issue in progress. The dispatcher (the chief of staff, or the owner's own session until #695
  builds it) runs that check before every claim. When in doubt, wait until one is In review or
  Done. The highest-priority Ready item goes first.
- **Shared hot spots** (this list is the one definition; two issues that each touch any of these
  count as overlapping, even in different lines): anything in `src/platform/` and `src/themes/`;
  the frontend layout, header, navigation and `globals.css`; `src/payload.config.ts`,
  `src/payload-types.ts` and `src/migrations/`; `package.json` and the lockfile; and the process
  files (`AGENTS.md`, `CLAUDE.md`, `.agents/`, `.claude/`, `.github/`, `docs/guidelines/`,
  `docs/roles/`, `docs/process/`).
- **In progress is set when work starts,** before the first commit, so the board shows it. In
  review and Done stay automatic.
- **Assigning the issue moves its card** to In progress, through the planner app (the Access note
  above), from any device. An agent never moves a card by hand or by comment: it assigns the issue and the app does the rest. Where that workflow is not running, a session on the owner's computer
  moves the card, and a cloud session says on the issue which card to move.

## The record on the issue

Every step an agent takes leaves a comment, so the issue shows what happened without reading chat.
A comment starts with one of these headers, so a person or a script can find it:

- `### [STEP] <title>`: claimed, started, PR opened, review finished, merged.
- `### [DECISION] <title>`: a choice and why, with the alternatives. Include the date and where
  the owner decided, when he did, as a summary, never his words.
- `### [QUESTION] <title>`: one plain question with options and a recommendation. If only the owner
  can answer, add the `needs owner` label and end with `Owner needed: yes`.
- `### [PUSHBACK] <title>`: why an agent thinks a request is weaker than the standard approach.
- `### [SCOPE] <title>`: new work found; links the new issue, which gets `scope-creep`.

**Claiming.** One dispatcher (the chief of staff, or a person) hands an issue to an agent and does
the steps below in order, so two agents can't win the same one; a worker checks that the claim
names its branch and doesn't claim anything itself. Agents all act through the owner's GitHub login, so the assignee can't
show who holds an issue: the `[STEP]` comment and the **In progress** status do. In order: (1)
check for overlap with whatever is already In progress; (2) check the issue isn't already
claimed (not In progress, no `[STEP]` claim comment); (3) post a `[STEP]` comment naming the
branch and assign the issue; (4) set **In progress**. Then start.

## Definition of Ready

An issue is **Ready** when it has:

- what and why, in plain language
- acceptance criteria someone else could check
- **Files likely touched** and **Must not touch** filled in (write `None` when there is nothing),
  so overlap with other work can be checked
- an epic above it and a milestone ([the rule](../../AGENTS.md#one-issue-one-pull-request)), labels (type,
  area, priority) and a size.
  When the board can't be read (cloud sessions), skip Size and say so on the issue
  ([`project-tracking`](../../.agents/skills/project-tracking/SKILL.md) §1)
- no open blocker: nothing it's **blocked by** is still open
- no `needs owner` label: that work waits for the owner, not for a sprint

The criteria for each board move, including Ready, are spelled out in the
[grooming playbook](grooming-playbook.md#board-moves-entry-and-exit-criteria).

## Definition of Done

An issue is **Done** when:

- its PR has passed every required check and its independent review, and is merged
  ([`AGENTS.md`](../../AGENTS.md))
- the knowledge note for the code it changed is updated, or the PR declares "no behavior change"
  and the reviewer agreed ([decision 0019](../architecture/decisions/0019-knowledge-layer.md))
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
