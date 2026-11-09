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

1. **List the owner's open questions first.** Everything labeled `needs owner`, open, oldest first,
   at most seven, one line each: number, plain title, how long it has waited. Pull requests count
   too (the issues endpoint returns them).

   ```bash
   gh api "repos/{owner}/{repo}/issues?labels=needs%20owner&state=open&sort=created&direction=asc&per_page=7" \
     -q '.[] | "#\(.number)\(if .pull_request then " (PR)" else "" end) \(.title) (since \(.created_at[:10]))"'
   ```

   Count them with the search API, since the list stops at seven:

   ```bash
   gh api "search/issues?q=repo:{owner}/{repo}+is:open+label:%22needs+owner%22&per_page=1" -q .total_count
   ```

   If there are more than seven, say how many wait and show the seven oldest. Stop there and let
   the owner answer before anything else. Silence is never a yes.

2. **Then propose the next batch.** From the current milestone ([`project-tracking`](../project-tracking/SKILL.md) §2),
   keep Ready issues only (§1 there), highest priority first. Run the overlap check (§3) on the
   proposed set and drop what clashes. Offer the batch with one line each and why.
3. Dispatch only after the owner agrees to the batch, or when he has already said to keep going.

## 2. Groom

Write or rewrite an issue so a worker can follow it without guessing, at high effort. It meets the
[Definition of Ready](../../../docs/process/project-management.md#definition-of-ready): a plain
summary, then details, then acceptance criteria someone else can check; labels (one type, areas,
one priority); a parent, or a stated reason it stands alone; a size; **Files likely touched** and
**Must not touch**, each as backticked paths (the overlap check reads only those; a bare name with no extension, such as
`Makefile`, or prose counts as undeclared, so write the folder or add the extension) or `None`; the role guides and knowledge
notes a worker must load; and an open-questions line. Split anything bigger than L. Sizing,
priority and sprint judgment stay with you; moves that must happen every time belong to the
board's built-in workflows, not to you.

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

1. **Default to a dry run.** Read, then post one report comment on the issue the owner names (ask
   once if he named none). Change nothing else. Apply only what he approved in that run, and
   comment each change ([modes](../../../docs/process/grooming-playbook.md#modes-dry-run-and-apply)).
2. **Read the plan from GitHub,** paging every list (100 items at most per call):

   ```bash
   gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" -q '.[] | "\(.number) \(.state) \(.title) \(.open_issues)/\(.closed_issues)"'
   gh api "repos/{owner}/{repo}/issues?state=open&per_page=100&page=1" -q '.[] | select(.pull_request | not) | "#\(.number) \(.milestone.number // "-") \(.title)"'
   gh api repos/{owner}/{repo}/issues/<n>/parent -q .number                  # 404: no parent
   gh api repos/{owner}/{repo}/issues/<epic>/sub_issues -q '.[] | "#\(.number) \(.state)"'
   ```

3. **Apply, when approved,** with the REST calls the changes need: create or edit a milestone
   (`-X POST` or `-X PATCH` on `milestones`, with `title` and `description`, and `due_on` only for
   a real date, including one the owner decides), set an issue's milestone (`-X PATCH issues/<n> -F milestone=<number>`), link a
   child ([`project-tracking`](../project-tracking/SKILL.md) §3 step 4). Comment before closing a
   duplicate and name its survivor.
4. **Retro-organization** of existing issues is the playbook's
   [procedure](../../../docs/process/grooming-playbook.md#retro-organization): a dry-run proposal of
   milestones, epics and groupings first, owner approval, then apply in the order it gives.
5. **Sprints and native fields** (Priority, Effort, Size, iteration): read them from the board when
   the session can reach it, and set a board field or move an iteration only from a session on the
   owner's computer (`gh project item-edit`). Native issue fields are written with a `PUT`, which
   this agent cannot send, so list each as a proposal ("set Priority to X on #N") for a session
   that can. Sprint pulls and rollover follow the
   [planning model](../../../docs/process/planning-model.md#sprint).
6. You still never edit code, push or merge. A cloud session cannot move board cards: say which
   card moves where.
