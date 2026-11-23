# Weekly review

The team's retrospective. Work flows continuously ([planning model](planning-model.md#flow)), so
improvement does not wait for the end of a time box: once a week, and whenever the owner asks, the
chief of staff looks back over the last seven days and decides what to change. It is kept apart
from the board and reads GitHub only, so any session can run it and nothing depends on a chat.

The Kanban Guide sets no fixed meeting cadence, so the weekly rhythm is our choice, not the
guide's. A finding is evidence from GitHub, never a recollection or an estimate.

## How to run it

Use `gh api` (REST), which works in cloud sessions
([`project-tracking`](../../.agents/skills/project-tracking/SKILL.md)). Read every page of every
list, and set the window first:

```bash
since=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)
```

1. **What shipped, by milestone.** Run the closed-issues query in
   [`project-tracking` §5](../../.agents/skills/project-tracking/SKILL.md#5-weekly-report-what-got-done-this-week);
   its output is grouped by milestone, and the same section gives each open milestone's counts.
2. **Checks that failed repeatedly.** Failed runs on pull requests, counted by workflow name, as in
   the [start of a session](../../.agents/skills/chief-of-staff/SKILL.md#1-start-of-session). A
   check that failed again and again is a wall the workers keep hitting: find its cause.
3. **Review findings that came back.** For each pull request merged in the window, read the
   review (`pulls/<n>/reviews`, `pulls/<n>/comments`, `issues/<n>/comments`) for blockers and the
   kind of finding. The same kind on several pull requests means a rule, a test or a template is
   missing or unclear.
4. **Friction the workers noted.** Read the `### [STEP]` comments on the issues that shipped
   (`issues/<n>/comments`, header match): what failed, what took longer than it should, what
   they would automate ([roles](../roles/README.md#weekly-review-every-role)).
5. **Where the owner had to step in.** Issues that got `needs owner` in the window, with how long
   each waited, from the events, and the `[DECISION]` comments that record a decision of his:

   ```bash
   gh api --paginate "repos/{owner}/{repo}/issues/events?per_page=100" \
     -q ".[] | select(.event == \"labeled\" and .label.name == \"needs owner\" and .created_at >= \"$since\") | \"#\\(.issue.number)\""
   ```

   A step that needed him and did not have to is a rule to write or a tool to add.

6. **What to automate next.** A manual step seen in several of the above (a hand move of a card,
   a repeated fix, a repeated question) is the candidate. Prefer a free tool that fails a check by
   itself over agent judgment ([development](../guidelines/development.md#fast-by-default-public-pages-first)).

## What it cannot measure

Say so in the report instead of estimating:

- **Token cost per task.** It is not recorded anywhere yet; measuring it is separate work.
- **Who acted.** Agents act through the owner's account, so a person's action and an agent's look
  the same on an issue, except where a record says otherwise
  ([card history](../../.agents/skills/project-tracking/SKILL.md#4-while-working)).
- **Reverts and reopenings by a person,** for the same reason.
- **The Kanban Guide's flow metrics and service level expectation.** We track neither; the review
  reads what shipped and what stalled instead.
- **A list cut off at a page limit** is a sample, so the report says it is not a total.

## The report

One comment, short enough to read in a minute, with the header `### [STEP] Weekly review`. It goes
on the issue the owner names; with none named, on the open issue that holds the previous review,
or in the chat. The chief of staff finds the last one by searching comments for that header, and
at the start of a session offers a new one when none is under seven days old. It holds: what
shipped by milestone, what failed repeatedly, what came back from review, the friction noted, where
the owner stepped in, what to automate, and what could not be measured. Each finding that needs a
change becomes an issue, filed and groomed like any other
([`project-tracking`](../../.agents/skills/project-tracking/SKILL.md) §3); a change to a rule is a
policy change and waits for the owner ([`AGENTS.md`](../../AGENTS.md), step 3).
