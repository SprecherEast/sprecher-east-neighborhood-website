# The board status rule

The one rule for what each board card should say, worked out from facts GitHub records. It is a
tested function (`scripts/planner-status.mjs`) that returns the status, a one-sentence reason and
flags, and never acts on them. Where it fits in the board: [how we work](project-management.md#the-board).

## The rule

The first row that matches wins:

1. The issue is closed: **Done**.
2. An open pull request that GitHub lists as closing it: **In review**. A plain mention does not
   count.
3. It is claimed (assigned, and a `### [STEP]` claim comment names a branch) and not resolved:
   **In progress**. There is no timer: a claimed issue that goes quiet is still In progress.
4. It has the `ready` label, passes [the issue check](issue-and-pr-checks.md#the-issue-check) and
   has no `needs owner`: **Ready**.
5. Anything else that is open: **Backlog**.

An epic never takes its status from its assignee; it follows its children (In progress while a
child is In progress or In review, otherwise Backlog).

## Flags

Flags name provable problems and are only reported:

- assigned but never started: no claim comment names a branch, and no pull request in any state
  (open, merged or closed, and even if the issue was reopened after it) is in the issue's closing
  references or declares in its description that it closes the issue; a plain mention is not work
  started;
- a merged pull request declared it closes the issue (a closing reference GitHub recorded, or a
  closing keyword in a merged pull request of this repository) while the issue is still open and
  was not reopened after the merge; a plain mention never raises it;
- an open epic whose children are all closed;
- an open child of a closed parent.

## The report run

The `Planner Board` workflow's **report** run is started by hand (no schedule) as the planner app
with read-only access. It reads every open card, prints the ones that differ from the rule or carry
a flag in the job summary, and exits non-zero when it could not read everything, including when a
list on an issue was too long to read in full. It moves nothing: no card, label or assignee. The
event-driven moves in `scripts/planner-board.mjs` stay as they are until the rule replaces them.
