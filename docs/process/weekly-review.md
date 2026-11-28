# Weekly review

The team's retrospective. Work flows continuously ([planning model](planning-model.md#flow)), so
improvement does not wait for the end of a time box: once a week, and whenever the owner asks, the
chief of staff looks back over the last seven days and decides what to change. It is kept apart
from the board and reads GitHub only, so any session can run it and nothing depends on a chat.

A finding is evidence from GitHub, never a recollection or an estimate.

The [outsider review](../../.agents/skills/outsider-review/SKILL.md) is a separate, read-only look
at recent merges, with the power to pause work through the chief of staff; this review does not
have it.

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
   the [start of a session](../../.agents/skills/chief-of-staff/SKILL.md#1-start-of-session), but
   read every page (`&page=N`) until one comes back short, not only the latest hundred. A
   check that failed again and again is a wall the workers keep hitting: find its cause.
3. **Review findings that came back.** List the pull requests merged in the window:

   ```bash
   gh api --paginate "search/issues?q=repo:{owner}/{repo}+is:pr+is:merged+merged:>=${since%%T*}&per_page=100" -q '.items[].number'
   ```

   Then, for each, read the review (`pulls/<n>/reviews`, `pulls/<n>/comments`, `issues/<n>/comments`) for blockers and the
   kind of finding. The same kind on several pull requests means a rule, a test or a template is
   missing or unclear.

4. **Friction the workers noted.** Read the `### [STEP]` comments on the issues that shipped
   (`issues/<n>/comments`, header match): what failed, what took longer than it should, what
   they would automate ([roles](../roles/README.md#weekly-review-every-role)).
5. **Where the owner had to step in.** Issues that had `needs owner` in the window, and how long
   each waited, and the `[DECISION]` comments that record a decision of his. Read each candidate's
   own events, not the repository's whole event list; the wait is the time from the `labeled` event
   to the next `unlabeled` one (to now, while it is still open). Candidates are the issues updated
   since the window plus every open one labeled `needs owner`, which may have waited untouched:

   ```bash
   for n in $( (gh api --paginate "repos/{owner}/{repo}/issues?state=all&since=$since&per_page=100" -q '.[].number'; \
                gh api --paginate "repos/{owner}/{repo}/issues?labels=needs%20owner&state=open&per_page=100" -q '.[].number') | sort -un); do
     gh api --paginate "repos/{owner}/{repo}/issues/$n/events?per_page=100" \
       -q "[.[] | select(.label.name == \"needs owner\") | \"\\(.event) \\(.created_at)\"] | if length > 0 then \"#$n \\(join(\", \"))\" else empty end"
   done
   ```

   A step that needed him and did not have to is a rule to write or a tool to add.

6. **What to automate next.** A manual step seen in several of the above (a hand move of a card,
   a repeated fix, a repeated question) is the candidate. Prefer a free tool that fails a check by
   itself over agent judgment ([development](../guidelines/development.md#fast-by-default-public-pages-first)).

A process change the owner put on trial is checked against this evidence (review results and
problems met later) and revisited when it shows no benefit. The dated decisions in the
[operating model](agent-operating-model.md#the-owners-direction-summary-recorded-on-685-and-721)
mark which changes are on trial, and the report says, for each open trial, what the evidence showed
that week.

## What it cannot measure

Say so in the report instead of estimating:

- **Token cost per task.** It is not recorded anywhere yet; measuring it is separate work.
- **Who acted.** Agents act through the owner's account, so a person's action and an agent's look
  the same on an issue, except where a record says otherwise
  ([card history](../../.agents/skills/project-tracking/SKILL.md#4-while-working)).
- **Reverts and reopenings by a person,** for the same reason.
- **What the [planning model](planning-model.md#flow) says we do not track** (the Kanban Guide's
  measures); say so in the report instead of improvising a number.
- **A list cut off at a page limit** is a sample, so the report says it is not a total.

## The report

One comment, short enough to read in a minute, with the header `### [STEP] Weekly review`. It is
posted as a comment on the open issue that holds the previous review, or on the issue the owner
names. When none exists, post it on the standing `process` issue filed for this purpose: find it
by its form (a task of type `process`) and its title, "Weekly review", among open issues, and file
it once if absent. It may also be shown in chat, but the GitHub comment is what counts. It holds: what shipped by milestone,
what failed repeatedly, what came back from review, the friction noted, where the owner stepped in,
what each open trial showed, what to automate, and what could not be measured. Each finding that needs a change becomes an
issue, filed and groomed like any other
([`project-tracking`](../../.agents/skills/project-tracking/SKILL.md) §3); a change to a rule is a
policy change and waits for the owner ([`change-workflow`](../../.agents/skills/change-workflow/SKILL.md#the-path-to-main), step 3).

## When one is due

At the start of a chief of staff session, look for the last review where the report is posted:
issue comments written in the last seven days whose body starts with the header (`since` set as
above).

```bash
gh api --paginate "repos/{owner}/{repo}/issues/comments?since=$since&per_page=100" \
  -q '.[] | select(.body | startswith("### [STEP] Weekly review")) | .html_url'
```

None found means one is due: offer it. A review also runs whenever the owner asks.
