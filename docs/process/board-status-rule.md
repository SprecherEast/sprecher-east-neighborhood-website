# The board status rule

The one rule for what each board card should say, worked out from facts GitHub records. It is a
tested function (`scripts/planner-status.mjs`) that returns the status, a one-sentence reason and
flags. The planner app's event moves and the report run both decide through it, so they cannot
disagree. Where it fits in the board: [how we work](project-management.md#the-board).

## The rule

The first row that matches wins:

1. The issue is closed: **Done**.
2. An open pull request closes it: **In review**. That is a pull request GitHub lists as closing
   the issue, or one in this repository whose description says it closes it (an upper layer of a
   stack, which GitHub does not link). A plain mention does not count.
3. It is claimed and not resolved: **In progress**. Claimed means assigned, and work has started:
   a `### [STEP]` claim comment names a branch (`Branch: ` and the name in backticks, which is the
   form the dispatch brief uses), or a pull request in any state closes it or says it does, or a
   branch of the claim naming pattern (`agent/<role>/<issue>-<description>`) for it exists on the
   remote. Assignment alone is not a start. There is no timer: a claimed issue that goes quiet is
   still In progress, and `needs owner` does not pull it out of In progress.
4. It has the `ready` label, passes [the issue check](issue-and-pr-checks.md#the-issue-check) and
   has no `needs owner`: **Ready**.
5. Anything else that is open: **Backlog**.

An epic never takes its status from its assignee; it follows its children (In progress while a
child is In progress or In review, otherwise Backlog). A sub-issue that is not on the board counts
as Backlog for its epic. Issues and cards are told apart by repository and number.

## Flags

Flags name provable problems and are only reported, in the report and in the issue's "Board status"
comment. A flag never moves a card or changes a label or an assignee (never started is not raised on
an epic):

- assigned but never started: no claim comment names a branch, no pull request in any state (open,
  merged or closed, and even if the issue was reopened after it) is in the issue's closing references
  or declares in its description that it closes the issue, and no branch of the claim naming pattern
  exists; a plain mention is not work started;
- claimed and also labeled `needs owner`;
- a merged pull request declared it closes the issue (a closing reference GitHub recorded, or a
  closing keyword in a merged pull request of this repository) while the issue is still open and
  was not reopened after the merge; a plain mention never raises it;
- an open epic whose children are all closed;
- an open child of a closed parent.

## The event moves

When an event concerns an issue (opened, reopened, assigned, labeled, unlabeled, edited,
milestoned or demilestoned), the `Planner Board` workflow's move job reads that issue's facts,
works out the status the rule gives, and sets the card to it if it differs. For an epic it also
reads the open sub-issues that are on the board, so the epic follows them. Only the card of the
issue the event concerns is written. A card with no status gets one.

- **Whose words count.** The repository is public, so only a comment or pull request written by the
  owner, a member or a collaborator counts as a claim or as work on the issue.
- **Backward moves wait for the owner.** An event applies a forward move, but never moves a card to
  an earlier column unless the planner itself set the card's current status (its comment records
  it). It holds the move and says so in the comment; a manual run for that one issue applies it, and
  that run is how the owner confirms a card.
- **The reason.** Every move the planner makes, and every held move, is written first in one "Board
  status" comment on the issue, found again by a hidden marker and the app's own login, and edited in
  place. It says what the rule gives and why, so it stays true if the edit then fails or the card
  later moves on. It is built from fixed sentences: nothing read from an issue, a comment or a pull
  request, not even a branch name, goes into it.
- **What it writes.** The Status field and that comment. No label, no assignee, no other card.
- **Catching up.** Label changes made by other workflows start no run, and a run can read an issue a
  moment early; the next event, or a manual run for the issue, brings the card in line. A card
  that differs only because it was never visited is not swept: it moves when an event or a manual run
  concerns it. A manual run for a closed issue puts it Done and puts its card back on the board if
  it was archived.
- **Too long to read.** An issue with more than a hundred comments, cross-references or sub-issues
  cannot be read in full, so every run for it ends red and writes nothing; the report lists it.
- **App Check.** `Planner App Check` writes to the test issue and its card, never to a real one.

GitHub's built-in "Item reopened" board workflow, when it is on, sets a status of its own when an
issue is reopened. Whichever runs last holds until the next event or a manual run for the issue.

## The report run

The `Planner Board` workflow's **report** run is started by hand (no schedule) as the planner app
with read-only access. It reads every open card, prints the ones that differ from the rule or carry
a flag in the job summary, and exits non-zero when it could not read everything, including when a
list on an issue was too long to read in full. It moves nothing: no card, label, assignee or
comment. Its table is what the next event would change for each card that differs.
