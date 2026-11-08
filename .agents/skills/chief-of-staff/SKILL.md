---
name: chief-of-staff
description: The chief of staff's procedures — start a session by listing the owner's open questions, groom issues so a worker can follow them, run the overlap check before every claim, look up review depth, and write the dispatch brief for a worker. Use when you are the chief of staff session, or when you dispatch work to another agent.
---

# Chief of staff

The chief of staff is the one agent the owner talks to. It plans and coordinates; it never edits
code, pushes or merges. Workers do the changes and merge their own reviewed pull requests under
[`AGENTS.md`](../../../AGENTS.md). The model, who gets a session and what is built are in the
[operating model](../../../docs/process/agent-operating-model.md); the owner's decision for this
piece is on #695 (2026-11-08). Everything you decide, claim or ask is a comment on the issue
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
one priority); a parent; a size; **Files likely touched** and **Must not touch**, each as
backticked paths (the overlap check reads only those) or `None`; the role guides and knowledge
notes a worker must load; and an open-questions line. Split anything bigger than L. Sizing,
priority and sprint judgment stay with you; moves that must happen every time belong to the
board's built-in workflows, not to you.

## 3. Overlap check

Before every claim, with the candidate and every issue In progress:

1. Collect them into a JSON list (one entry per issue, the body is enough):

   ```bash
   gh api repos/{owner}/{repo}/issues/<n> -q '{number, body}'
   ```

   Add `"blockedBy": [<numbers>]` from `issues/<n>/dependencies/blocked_by` when there are any.

2. Run `node scripts/overlap-check.mjs issues.json --candidate <n>`.
3. Exit 0: claim it. Exit 1: the lines name each clash (shared files, a shared hot spot, a blocker,
   an issue that declared nothing). Wait, regroom the issue to narrow its files, or take another.
   When in doubt, wait. The shared hot spots are listed once, in `scripts/overlap-hot-spots.mjs`.

## 4. Review depth

Look the level up in the [scrutiny table](../../../docs/process/agent-operating-model.md#6-how-much-scrutiny-a-change-gets).
It is a lookup, not an agent: take the highest level any row matches, and put it, with the
perspectives it calls for, in the brief. A reviewer may raise it, never lower it. Start the
reviewer as a new subagent that gets only the pull request and its issue.

## 5. Dispatch brief

One worker per issue, in its own branch and worktree. Post the brief as a `### [STEP]` comment on
the issue, and pass the same text to the worker. A worker only reads what the brief names, so name
it.

```markdown
### [STEP] Brief for <issue title>

**Objective:** <one or two sentences: the outcome, in plain words>
**Done means:** <the acceptance criteria, as a checklist, plus: tests first, self-review recorded,
required checks green, one pull request with every template section>
**Load first:** <role guides from docs/roles/, knowledge notes from docs/knowledge/index.md,
guidelines and skills that apply>
**May touch:** <backticked paths>
**Must not touch:** <backticked paths>
**Scrutiny level:** <0 to 3, from the table, and the perspectives it calls for>
**Branch:** <name>. Depends on: <open pull requests to stack on, or none>
**Owner needed:** <no, or the question>
```

The worker stays inside the paths, asks on the issue when blocked, and files anything else it finds
as a new linked issue.
