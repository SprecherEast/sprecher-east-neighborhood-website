# Weekly review

The team's retrospective. Work flows continuously ([planning model](planning-model.md#flow)), so
improvement does not wait for the end of a time box: once a week, and whenever the owner asks, the
chief of staff looks back over the last seven days and decides what to change. It is kept apart
from the board and reads GitHub only, so any session can run it and nothing depends on a chat.

The Kanban Guide sets no fixed meeting cadence, so the weekly rhythm is our choice, not the
guide's. A finding is evidence from GitHub, never a recollection or an estimate.

## How to run it

Use `gh api` (REST), which works in cloud sessions
([`project-tracking`](../../.agents/skills/project-tracking/SKILL.md)). Page every list
(100 items at most per call). Set the window first:

```bash
since=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)
```

1. **What shipped, by milestone.** Issues closed as completed in the window, grouped by their
   milestone, with the milestone's open and closed counts:

   ```bash
   gh api "repos/{owner}/{repo}/issues?state=closed&since=$since&per_page=100" \
     -q ".[] | select(.pull_request | not) | select(.state_reason == \"completed\") | select(.closed_at >= \"$since\") | \"\\(.milestone.title // \"no milestone\")\\t#\\(.number) \\(.title)\""
   gh api "repos/{owner}/{repo}/milestones?state=open&per_page=100" \
     -q '.[] | "\(.title): \(.closed_issues) closed, \(.open_issues) open"'
   ```

2. **Checks that failed repeatedly.** Failed runs on pull requests, counted by workflow name, as in
   the [start of a session](../../.agents/skills/chief-of-staff/SKILL.md#1-start-of-session). A
   check that failed again and again is a wall the workers keep hitting: find its cause.
3. **Review findings that came back.** For each pull request merged in the window, read the
   review comments and the review on the pull request
   (`pulls/<n>/comments`, `pulls/<n>/reviews`, `issues/<n>/comments`) for blockers and the kind of
   finding. The same kind of finding on several pull requests means a rule, a test or a template
   is missing or unclear.
4. **Where the owner had to step in.** Items labeled `needs owner` in the window and how long
   each waited, `[DECISION]` comments that record a decision of his, and merged pull requests
   that were reverted or reopened. A step that needed him and did not have to is a rule to write
   or a tool to add.
5. **What to automate next.** A manual step seen in several of the above (a hand move of a card,
   a repeated fix, a repeated question) is the candidate. Prefer a free tool that fails a check by
   itself over agent judgment ([development](../guidelines/development.md#fast-by-default-public-pages-first)).

## What it cannot measure

Say so in the report instead of estimating:

- **Token cost per task.** It is not recorded anywhere yet; measuring it is separate work.
- **Who acted.** Agents act through the owner's account, so a person's action and an agent's look
  the same on an issue, except where a record says otherwise
  ([card history](../../.agents/skills/project-tracking/SKILL.md#4-while-working)).
- **Anything the list calls cut off.** A list read to its page limit is a sample, so the report
  says it is not a total.

## The report

One comment, short enough to read in a minute, on the issue the owner names (or in the chat when
he asks there). It starts with `### [STEP] Weekly review` and holds: what shipped by milestone,
what failed repeatedly, what came back from review, where the owner stepped in, what to automate,
and what could not be measured. Each finding that needs a change becomes an issue, filed and
groomed like any other ([`project-tracking`](../../.agents/skills/project-tracking/SKILL.md) §3);
a change to a rule is a policy change and waits for the owner
([`AGENTS.md`](../../AGENTS.md), step 3).
