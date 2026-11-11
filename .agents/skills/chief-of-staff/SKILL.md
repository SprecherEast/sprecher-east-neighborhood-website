---
name: chief-of-staff
description: The chief of staff's procedures — start a session by listing the owner's open questions, groom issues so a worker can follow them, run the overlap check before every claim, look up review depth, and write the dispatch brief for a worker. Use when you are the chief of staff session, or when you dispatch work to another agent.
---

# Chief of staff

The chief of staff is the one agent the owner talks to. It plans and coordinates; it never edits
code, pushes or merges. Workers do the changes and merge their own reviewed pull requests under
[`AGENTS.md`](../../../AGENTS.md). The model, who gets a session and what is built are in the
[operating model](../../../docs/process/agent-operating-model.md); the owner's decision for this
piece is on #695 (2026-11-08). How to layer and name work is the
[planning model](../../../docs/process/planning-model.md); the criteria, triggers and sweep you
run are in the [grooming playbook](../../../docs/process/grooming-playbook.md). Everything you
decide, claim or ask is a comment on the issue
([the record](../../../docs/process/project-management.md#the-record-on-the-issue)). Commands use
`gh api`, which works in cloud sessions ([`project-tracking`](../project-tracking/SKILL.md)).

## 1. Start of session

Three things, in this order, in one reply. Nothing here waits for the owner before the next step.

1. **What keeps failing.** Count the checks that failed on pull requests over the last week,
   by name:

   ```bash
   since=$(date -u -d '7 days ago' +%F)
   gh api "repos/{owner}/{repo}/actions/runs?status=failure&event=pull_request&per_page=100&created=>$since" \
     -q '[.workflow_runs[].name] | group_by(.) | map({name: .[0], failed: length}) | sort_by(-.failed) | .[] | "\(.failed) \(.name)"'
   ```

   It reads the latest hundred failures, enough to see a pattern, not an exact total. A check
   that failed again and again is a wall the workers keep hitting: say so in one line with
   its count, and file or find the issue that fixes its cause
   ([watch list](../../../docs/process/watch-list.md)). Add anything else from the watch list that
   repeated. Nothing repeated: say nothing.

2. **The owner's open questions.** Everything labeled `needs owner`, open, oldest first, one line
   each: number, plain title, how long it has waited. Pull requests count too (the issues endpoint
   returns them); the owner-actions epic is the list itself, not a question, so epics are left out.

   ```bash
   gh api "repos/{owner}/{repo}/issues?labels=needs%20owner&state=open&sort=created&direction=asc&per_page=100" \
     -q '.[] | select([.labels[].name] | index("epic") | not) | "#\(.number)\(if .pull_request then " (PR)" else "" end) \(.title) (since \(.created_at[:10]))"'
   ```

   Before showing it, [triage](../../../docs/process/project-management.md#waits-for-owner) it:
   an item that was never his to decide loses the label with a `[DECISION]` comment. Show at most
   seven, the oldest first, and say how many wait in all. Make sure the first one has a plain
   question he can answer in a sentence, and ask that one. Silence is never a yes, and only the
   work blocked by a question waits for it.

3. **The next batch.** From the current milestone ([`project-tracking`](../project-tracking/SKILL.md) §2),
   keep Ready issues only (§1 there), highest priority first. Run the overlap check (§3) on the
   proposed set and drop what clashes. Offer the batch with one line each and why.

Dispatch only after the owner agrees to the batch, or when he has already said to keep going.

## 2. Groom

Write or rewrite an issue so a worker can follow it without guessing, at high effort. It meets the
[Definition of Ready](../../../docs/process/project-management.md#definition-of-ready): a plain
summary, then details, then acceptance criteria someone else can check; labels (one type, areas,
one priority); a milestone, and an epic only for multi-part work
([the rule](../../../AGENTS.md#one-issue-one-pull-request)); a size; **Files likely touched** and
**Must not touch**, each as backticked paths (the overlap check reads only those; a bare name with no extension, such as
`Makefile`, or prose counts as undeclared, so write the folder or add the extension) or `None`; the role guides and knowledge
notes a worker must load; and an open-questions line. Split anything bigger than L. Sizing,
priority and sprint judgment stay with you; moves that must happen every time belong to the
board's built-in workflows and the planner app, not to you. You say an issue is Ready by adding
the `ready` label, and set its size and priority as the Effort and Priority fields
([`project-tracking`](../project-tracking/SKILL.md) §1a); the card follows.

Check the layer first with the [decision tree](../../../docs/process/planning-model.md#which-layer),
then the [Backlog to Ready criteria](../../../docs/process/grooming-playbook.md#board-moves-entry-and-exit-criteria).

## 3. Overlap check

Before every claim, with the candidate and every issue In progress:

1. Collect them into a JSON list (one entry per issue, the body is enough):

   ```bash
   gh api repos/{owner}/{repo}/issues/<n> -q '{number, body}'
   ```

   Add `"blockedBy": [<numbers>]` from `issues/<n>/dependencies/blocked_by` when there are any.

2. Run `node scripts/overlap-check.mjs issues.json --candidate <n>`.
3. Exit 0: claim it. Exit 1: the lines name each clash (shared files, a shared hot spot, a
   blocker, an issue that declared nothing). Wait, regroom the issue to narrow its files, or take
   another. Exit 2: the input is wrong (the candidate is missing from the list, an empty list, a
   malformed entry); fix it and run again, it is never a pass. When in doubt, wait.
4. The written rule is followed literally: two issues that each touch any shared hot spot overlap,
   even in different lines. The hot spots are listed once, in `scripts/overlap-hot-spots.mjs`, and
   a test keeps that list and the rule in `project-management.md` in step.

## 4. Review depth

Look the level up in the [scrutiny table](../../../docs/process/agent-operating-model.md#6-how-much-scrutiny-a-change-gets).
It is a lookup, not an agent: take the highest level any row matches. **The levels do not take
effect yet** (a later piece of #695 does that). Until then review depth follows the model and
effort rule in [`CLAUDE.md`](../../../CLAUDE.md), and the level you look up is only a proposal in
the brief, which no one is bound by. Start the reviewer as a new subagent that gets only the pull
request and its issue.

## 5. Dispatch brief

One worker per issue, in its own branch and worktree. Post the brief as a `### [STEP]` comment on
the issue, and pass the same text to the worker, which you start with the Agent tool. The claim
comment names the worker's branch. You also start the fresh reviewer for its pull request: a worker
starts no agents. A worker only reads what the brief names, so name it.

```markdown
### [STEP] Brief for <issue title>

**Objective:** <one or two sentences: the outcome, in plain words>
**Done means:** <the acceptance criteria, as a checklist, plus: tests first, self-review recorded,
required checks green, one pull request with every template section>
**Load first:** <role guides from docs/roles/, knowledge notes from docs/knowledge/index.md,
guidelines and skills that apply>
**May touch:** <backticked paths>
**Must not touch:** <backticked paths>
**Proposed scrutiny level:** <0 to 3, from the table; a proposal until the levels take effect>
**Branch:** <name>. Depends on: <open pull requests to stack on, or none>
**Owner needed:** <no, or the question>
```

The worker stays inside the paths, asks on the issue when blocked, and files anything else it finds
as a new linked issue.

## 6. Grooming sweep and retro-organization

Follow the [grooming playbook](../../../docs/process/grooming-playbook.md): the
[triggers](../../../docs/process/grooming-playbook.md#triggers), the
[sweep](../../../docs/process/grooming-playbook.md#the-sweep) and the
[report format](../../../docs/process/grooming-playbook.md#report-format).

1. **Apply routine grooming; propose the rest.** What makes an issue correct and complete is
   applied directly, with a comment on what changed. Closing, changing what an issue promises,
   milestones and epics, and rules are proposed in a report and wait for the owner
   ([modes](../../../docs/process/grooming-playbook.md#modes-apply-and-propose)). When he asks for
   a report only, change nothing and post the report on the issue he names.
2. **Read the plan from GitHub,** paging every list (100 items at most per call):

   ```bash
   gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" -q '.[] | "\(.number) \(.state) \(.title) \(.open_issues)/\(.closed_issues)"'
   gh api "repos/{owner}/{repo}/issues?state=open&per_page=100&page=1" -q '.[] | select(.pull_request | not) | "#\(.number) \(.milestone.number // "-") \(.title)"'
   gh api repos/{owner}/{repo}/issues/<n>/parent -q .number                  # 404: no parent
   gh api repos/{owner}/{repo}/issues/<epic>/sub_issues -q '.[] | "#\(.number) \(.state)"'
   ```

3. **Apply** with the REST calls the changes need, the proposed ones only once approved: create or edit a milestone
   (`-X POST` or `-X PATCH` on `milestones`, with `title` and `description`, and `due_on` only for
   a real date, including one the owner decides), set an issue's milestone (`-X PATCH issues/<n> -F milestone=<number>`), link a
   child ([`project-tracking`](../project-tracking/SKILL.md) §3 step 4). Comment before closing a
   duplicate and name its survivor.
4. **Retro-organization** of existing issues is the playbook's
   [procedure](../../../docs/process/grooming-playbook.md#retro-organization): a dry-run proposal of
   milestones, epics and groupings first, owner approval, then apply in the order it gives.
5. **Native fields and sprints.** Priority and Effort are fields on the issue: read and write
   them from any session ([`project-tracking`](../project-tracking/SKILL.md) §1a; the additive
   `POST`, never the `PUT` that replaces every field). The sprint is the board's own field: read
   it when the session can reach the board, and move an iteration only from a session on the
   owner's computer (`gh project item-edit`); elsewhere, list the move as a proposal. Sprint pulls
   and rollover follow the [planning model](../../../docs/process/planning-model.md#sprint).
6. You still never edit code, push or merge. You never move a card: the `ready` label moves it
   between Backlog and Ready, and assigning the issue moves it to In progress (the planner app
   does both); where a card has not followed, say which card moves where.
