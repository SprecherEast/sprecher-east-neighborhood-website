---
name: project-tracking
description: Keep the project's plan on GitHub. Before starting work, read the issue's epic, milestone, sprint and blockers; when filing new work, put it at the right level with labels, parent, milestone and dependencies; answer "what's next?" and "what got done this week?" from GitHub, not from memory. Use when picking up, filing or reporting work.
---

# Project tracking

The conventions are in [how we work](../../../docs/process/project-management.md), the layers and
how to choose one in the [planning model](../../../docs/process/planning-model.md), grooming
triggers, board-move criteria and the sweep in the
[grooming playbook](../../../docs/process/grooming-playbook.md), and the milestones and epics in
the [roadmap](../../../docs/product/roadmap.md). This skill is the procedure. GitHub is the only source of truth: answer from it, never from memory or chat history.

The commands use the REST API through `gh api`, which works in cloud sessions too (`gh issue` and
`gh pr` subcommands use GraphQL, which some sandboxes block). In this repo, `{owner}/{repo}` is
`boulaajaj/sprecher-east-neighborhood-website`. List calls return at most 100 items, so loop over
`&page=N` as in §3 when a list can be longer; `--paginate` fails in some sandboxes.

## 1. Before starting an issue

```bash
gh api repos/{owner}/{repo}/issues/<n> -q '{title, state, milestone: .milestone.title, labels: [.labels[].name]}'
gh api repos/{owner}/{repo}/issues/<n>/parent -q '"#\(.number) \(.title)"'      # its epic (404: none)
gh api repos/{owner}/{repo}/issues/<n>/dependencies/blocked_by -q '.[] | "#\(.number) \(.state)"'
```

The sprint and the size are board fields. On the owner's computer, read them from the board's
items (§2 step 4 without `--query`, then find the issue by number in the JSON). Start only if the
issue is **Ready**:

- it has acceptance criteria, a parent (or a stated reason it stands alone), type, area and
  priority labels, and a size
- **Files likely touched** and **Must not touch** are filled in (`None` when there is nothing)
- nothing it's blocked by is still open
- it isn't labeled `needs owner`
- no open PR already closes it (the list in §2 step 3)

When the board can't be read (cloud sessions), skip the size check and say so in a comment on the
issue. If the issue isn't Ready, groom it (§1a) or pick another one. Read the parent epic too: it
says what the issue is part of. More than one issue may be in progress only when their files
don't overlap ([the rule](../../../docs/process/project-management.md#grooming-and-work-in-progress)),
so every issue after the first needs the overlap check below to pass.

## 1a. Grooming

Before every major change (a new epic, a sprint, a batch of work), groom the backlog
([rules and the owner's direction](../../../docs/process/project-management.md#grooming-and-work-in-progress)).
For each issue:

1. Give it a plain summary, acceptance criteria, a parent epic (or a stated reason it stands
   alone), the type, area and `priority:` labels (§3), and its **Files likely touched** and **Must not touch** (`None` when nothing),
   which the overlap check in §4 reads.
2. Set its **Size** as effort: S, M or L. If it is bigger than L, split it into sub-issues. In a
   cloud session, which can't read the board, skip Size and say so on the issue.
3. When it meets the Definition of Ready (the
   [Backlog to Ready criteria](../../../docs/process/grooming-playbook.md#board-moves-entry-and-exit-criteria)),
   move it to **Ready**. On the owner's computer, move the
   card as in §4. In a cloud session, comment on the issue that its card goes to Ready.

## 2. "What's next?"

1. Find the current milestone, the open one with the nearest due date:
   `gh api "repos/{owner}/{repo}/milestones?state=open&sort=due_on&direction=asc" -q '.[0] | {number, title, due_on, open_issues, closed_issues}'`
2. List its open issues:
   `gh api "repos/{owner}/{repo}/issues?milestone=<number>&state=open&per_page=100" -q '.[] | select(.pull_request | not) | "#\(.number) [\([.labels[].name] | join(", "))] \(.title)"'`
3. Leave out:
   - epics, and anything labeled `needs owner`
   - anything with an open blocker (one `blocked_by` call per issue, as in §1)
   - anything an open PR already closes or is part of. Those are **in progress**:

     ```bash
     gh api "repos/{owner}/{repo}/pulls?state=open&per_page=100" \
       -q '.[] | "PR #\(.number) → \([(.body // "") | scan("(?i)(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|part of):?\\s+#[0-9]+")] | join(", "))"'
     ```

   Order the rest by priority label, then by the order of the epic's sub-issues
   (`gh api repos/{owner}/{repo}/issues/<epic>/sub_issues`).

4. On the owner's computer, the board is the authority on what's in the sprint. Read the current
   sprint with
   `gh project item-list 2 --owner boulaajaj --limit 1000 --query "sprint:@current" --format json`.
   That needs `gh` signed in with the `project` scope. Cloud sessions can't reach the board, so
   say that the answer comes from the milestone instead.

## 3. Filing new work

1. **Choose the level** with the [decision tree](../../../docs/process/planning-model.md#which-layer)
   and the [naming templates](../../../docs/process/planning-model.md#templates).
   - An outcome over months, with a done test, is a milestone; a capability of a month to a
     quarter is an epic (label `epic`, one milestone).
   - One deliverable that fits one sprint and one PR is an issue; a standalone one says why.
   - Something broken is a bug.
2. **Search first** to avoid duplicates. Loop over the pages, since the repo has more than 100
   issues and PRs:

   ```bash
   for p in $(seq 1 20); do
     url="repos/{owner}/{repo}/issues?state=all&per_page=100&page=$p"
     gh api "$url" -q '.[] | select(.pull_request | not) | select(.title | test("<word>"; "i")) | "#\(.number) \(.state) \(.title)"'
     [ "$(gh api "$url" -q length)" -lt 100 ] && break
   done
   ```

3. **Create it** with the issue form's sections (`### Problem`, `### Proposed fix`,
   `### Acceptance criteria`, `### Files likely touched`, `### Must not touch`,
   `### Area`, `### Priority`) in `issue.md`. `parent_issue_id` is the
   epic's `id` (not its number); leave it out for a new epic.

   ```bash
   epic=$(gh api repos/{owner}/{repo}/issues/<epic> -q .id)
   gh api -X POST repos/{owner}/{repo}/issues -f title='<type>: <short problem statement>' \
     -F body=@issue.md -f 'labels[]=bug' -f 'labels[]=cms' -f 'labels[]=priority: medium' \
     -F parent_issue_id=$epic -F milestone=<number>   # milestone only if it's planned
   ```

   Exactly one type, at least one area and one priority
   ([`.github/label-policy.json`](../../../.github/label-policy.json)). GitHub's issue `type` field
   is dropped when set this way from the owner's token, so rely on the type label.

4. **Link it** when it already exists, or when it can't start before another issue is done:

   ```bash
   id=$(gh api repos/{owner}/{repo}/issues/<issue> -q .id)
   gh api -X POST repos/{owner}/{repo}/issues/<epic>/sub_issues -F sub_issue_id=$id
   blocker=$(gh api repos/{owner}/{repo}/issues/<blocker> -q .id)
   gh api -X POST repos/{owner}/{repo}/issues/<issue>/dependencies/blocked_by -F issue_id=$blocker
   ```

   A sub-issue has one parent. Don't move an issue to another epic just to group it; use a label
   or a link in the epic's description instead.

5. **Needs the owner?** Only if he alone can do it (a login, a payment), it needs his decision on
   a genuine product trade-off, a meaningful cost, a legal or privacy commitment, or a decision
   established best practice can't reasonably resolve, or it changes policy he didn't ask for
   ([`AGENTS.md`](../../../AGENTS.md) step 3). A choice between technically valid approaches
   isn't one: decide it, record why on the issue, and carry on. If it does:
   - label it `needs owner`
   - add it to the checklist in the owner-actions epic (#169); its parent stays its own epic
   - mark the issues that depend on it as blocked by it
   - stop: it waits for him
     ([waits for owner](../../../docs/process/project-management.md#waits-for-owner))

   Ask him on the issue under a `### [QUESTION]` header, and in the chat too when he's there. Make it easy to answer:

   ```markdown
   **Question:** Should volunteers sign up with a phone number as well as an email?

   - **A. Email only (recommended):** less personal data to keep and protect.
   - **B. Email and phone:** organizers can text people, but we store and guard more data.

   Reply A or B. Until then, this issue and #123 wait.
   ```

   One question per message, plain words, no code or file names unless he asks. When there are
   several, ask the most important first and the next once he has answered.

## 4. While working

- **Claim the issue first.** The dispatcher does this (the chief of staff, or the owner's own
  session until #695 builds it), in order; a worker started by it only checks that the claim
  names its branch and never claims anything itself
  ([the record on the issue](../../../docs/process/project-management.md#the-record-on-the-issue)):
  1. Overlap check, if anything is already In progress: list it with
     `gh project item-list 2 --owner boulaajaj --limit 1000 --format json --jq '.items[]|select(.status=="In progress")|.content.number'`
     (`--limit` matters: the default stops at 30 items). Read each one's **Files likely touched**
     and compare with this issue's and with the shared hot spots. A shared file or hot spot, or a
     blocker between them, means wait.
  2. Check it isn't already claimed: not In progress, and no `### [STEP]` claim comment. All
     agents use the owner's login, so the assignee can't tell them apart. An agent the chief of
     staff started has already been handed the issue; it never picks another.
  3. Post a `### [STEP]` comment with the branch name and assign the issue
     (`gh issue edit <n> --add-assignee <login>`), then set **In progress** (below). Only now
     start the first commit.
- Post a progress comment as work happens: claimed, started, PR opened, review done, merged
  ([triggers](../../../docs/process/grooming-playbook.md#triggers)).
- Keep the issue current with the comment headers in the record on the issue: `[DECISION]` for
  a choice and its reason, `[QUESTION]` for what you need answered (`needs owner` if only the
  owner can), `[PUSHBACK]` when a request looks weaker than the standard approach, `[STEP]` as
  the work moves.
- New work found along the way becomes a new issue (§3) with the `scope-creep` label, linked
  with a `[SCOPE]` comment on the original. Don't widen the current PR.
- **Set In progress when work starts, before the first commit.** On the owner's computer, move the
  board's **Status** (`In progress`; `In review` and Done are automatic) with `gh project item-edit`. It needs the item, project, field and option IDs: get them from
  `gh project item-list 2 --owner boulaajaj --format json`,
  `gh project field-list 2 --owner boulaajaj --format json` and
  `gh project view 2 --owner boulaajaj --format json -q .id`. Closing an issue or
  merging a PR moves the item to Done on its own. A cloud session can't move cards: it comments
  on the issue which card to move and to which column ("move to In progress"), and the next
  session on his computer moves it.

## 5. Weekly report: "what got done this week?"

```bash
since=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)
gh api "repos/{owner}/{repo}/issues?state=closed&since=$since&per_page=100" \
  -q ".[] | select(.pull_request | not) | select(.state_reason == \"completed\") | select(.closed_at >= \"$since\") | \"#\\(.number) \\(.title)\""
gh api "repos/{owner}/{repo}/milestones?state=open" -q '.[] | "\(.title): \(.closed_issues) done, \(.open_issues) open, due \(.due_on)"'
gh api "repos/{owner}/{repo}/issues?labels=needs%20owner&state=open&per_page=100" -q '.[] | "#\(.number) \(.title)"'
```

`since` filters by last update, so the `closed_at` check keeps only the issues closed in the
window, and `state_reason` drops duplicates and won't-fix. Report:

- what shipped (closed issues, grouped by epic: one `/parent` call per issue, as in §1)
- what's in progress (the open-PR list in §2 step 3)
- what's Ready next (§2)
- what's waiting on the owner (the `needs owner` list)
- milestone progress

Keep it short. It's for reading in a minute.
