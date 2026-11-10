# Planning model: layers, naming and sources

How work is layered on GitHub, and a rule for choosing the layer. It follows how large teams use
GitHub's planning features and the common agile references, not a scheme of our own. The levels
table and board are in [how we work](project-management.md); how to groom, sweep and reorganize
against this model is the [grooming playbook](grooming-playbook.md). This page holds principles
only: no examples taken from current work, so it stays true as the work changes.

## The layers at a glance

| Layer     | Answers                                      | Size                       | On GitHub                                      |
| --------- | -------------------------------------------- | -------------------------- | ---------------------------------------------- |
| Milestone | Which outcome is done, and how do we know?   | several capabilities       | A milestone; each issue has exactly one        |
| Epic      | Which capability does this body of work add? | several related issues     | A parent issue labeled `epic`, with sub-issues |
| Issue     | What single deliverable ships?               | fits in one sprint         | An issue; one PR closes it                     |
| Sub-issue | Which step is worth tracking on its own?     | part of an issue           | A child of an issue                            |
| Sprint    | What do we pull in for this time slice?      | one iteration of the board | The board's iteration field                    |

Labels, priority and size classify and rank. They never express hierarchy.

## GitHub's model compared with Jira's

Jira-style guidance puts stories under epics under initiatives, and a release or version beside
them. GitHub differs in ways that shape the rules here:

- **A milestone is one level.** It does not nest, belongs to one repository, and an issue has one
  milestone slot (the API takes a single milestone number). It cannot span repositories, and it
  has no parent milestone.
- **Hierarchy is sub-issues, not a separate type.** A sub-issue is an ordinary issue with a
  parent; the parent shows progress. GitHub allows nesting up to eight levels and up to 100
  sub-issues per parent. A child can live in another repository of the same owner. We keep to
  three levels (epic, issue, step) because deeper trees stop being readable.
- **An epic is a convention.** GitHub has no epic type. An epic here is a parent issue with the
  `epic` label. The level above it is the milestone, so we do not nest epics inside epics.
- **Issue types and issue fields are organization features.** Issue types, and organization-wide
  issue fields such as Priority and Effort, are defined at the organization level (the docs
  describe them for organizations and say nothing about personal accounts). Where they exist,
  native Priority and Effort are the ranking and size, and the board's own fields cover only what
  they do not (iteration). While a check or automation still reads the `priority:` label, the
  label stays required and the two must agree; the sweep reports any that differ. [How we
  work](project-management.md) still describes the board as a user project with priority as a
  label only; it is the older description and a later change brings it in line, so until then
  treat this page as the direction and that page as the current setup.
- **Sprints are a board field.** An iteration field on a project, not a repository feature, so a
  sprint is independent of milestones and pulls work from any of them.

## Milestone

An outcome with a clear "done" state that spans several capabilities.

- **One per issue,** and the title states the outcome as a result for someone, in plain words.
- **The description is the contract:** goal, scope, what is out of scope, and the done test (see
  [templates](#templates)). If you cannot write a pass or fail done test, it is not a milestone.
- **Backlog is the one exception:** a catch-all milestone for work not planned yet, with no done
  test, no outcome title and no finish line. The sweep's milestone checks skip it.
- **A due date only when a real date exists** (an event, a commitment, a dependency outside the
  team, or a date the owner decides), with the reason in the description. A date chosen to feel
  firm is a guess dressed as a plan. As a dated milestone nears, the sweep flags its open items
  and raises their priority.
- **Progress** is the share of its issues that are closed. For that number to mean something, the
  epics and the issues under them carry the milestone, not the epics alone.
- **It closes when the done test passes,** not when the issues run out. Closed issues may belong
  to it, and they count toward its progress.
- **You can take it in at a glance.** The goal fits in one line and the open work is small enough
  to read through. Past roughly a few dozen open issues, or when the goal no longer fits one line, it
  may be two outcomes: the chief of staff proposes a split, and the owner decides. There is no hard limit; the test is whether a neighbor could still read it.
- **The text is living.** When the route changes, the description and done test change with it,
  and a dated comment on the milestone says what changed and why. A change to the goal, the scope or the
  done test is proposed to the owner first; fixing wording is not.
- **A new milestone is proposed, not created.** The chief of staff names it, gives its done test
  and the issues it would hold, and waits for the owner's yes.

## Epic

A body of related issues delivering one capability.

- **A parent issue with sub-issues,** sized by shape, not by time: it groups several related
  issues that are tracked and searched together. Work that fits one pull request is an issue; work
  spanning several capabilities is a milestone.
- **It belongs to one milestone.** Unplanned and ongoing work sits in the catch-all Backlog
  milestone until it is planned ([the rule](../../AGENTS.md#one-issue-one-pull-request)).
- **The title is a capability noun phrase.** It names what the site or process can do, not an
  activity.
- **It closes when every child is done and its own acceptance is met.** Closed children are
  necessary, not sufficient: someone checks the epic's acceptance against the result.
- **Its children are the scope.** Do not keep a second list in the body that can drift from the
  sub-issues; link out to what is not a child.

## Issue and sub-issue

- **An issue is one deliverable,** small enough for one pull request and one sprint. This is the
  INVEST idea of a small, independent, testable story: it can be estimated, delivers value on its
  own, and has acceptance criteria someone else can check.
- **Every issue has a milestone; an epic above it is optional,** for work with several parts
  ([the rule](../../AGENTS.md#one-issue-one-pull-request)). A lone issue sits in its milestone with
  no epic. A sub-issue's parent is its epic, or an issue under it.
- **A sub-issue of an issue is a step worth tracking:** separately assignable or verifiable, and
  too big for a line in the acceptance criteria. If it is not, it is a line, not an issue.
- **A child has one parent.** Moving it to another parent is a deliberate change with a comment,
  not a way to group. Use a link in the parent's description for grouping.

## Sprint

A time slice on the board's iteration field, pulling from any milestone.

- **The plan names one goal** in a sentence (the Scrum Guide's Sprint Goal): the outcome the pulled
  work serves. Scope may change during the sprint; the goal stays.
- **Pull only Ready work,** highest priority first, leaving room for what comes up.
- **Rollover.** GitHub does not carry unfinished items over for you; items are moved by hand to the
  next iteration. At the end, work that is not Done is looked at one by one: still the right thing
  and nearly done moves to the next sprint with a comment on what is left; not started goes back to
  the backlog and is ordered again; carried twice means it is too big or blocked, so it is split or
  its blocker is linked. The Scrum Guide's view is the same: unfinished work returns to the backlog
  for later consideration, it is not counted as done.

## Labels and fields

- **Labels classify:** exactly one type, one or more areas, plus the fixed markers in
  [how we work](project-management.md#labels). No label names a milestone, an epic or a sprint.
- **Priority ranks** and **size estimates** effort. Neither says where work belongs. Within a
  priority, order comes from the position of sub-issues in their epic.
- **The `epic` marker** is the one label about layers: it says an issue is a parent. Membership
  comes from the parent link, never from a label.

## Dependencies

A dependency is a **blocked by** link on the issue, never a sentence like "after that other issue".
GitHub marks a blocked issue on project boards and the issue list, so the bottleneck is visible and
the overlap check can read it. When the blocker is a pull request that has not merged, stack the
pull requests instead ([`stacked-prs`](../../.agents/skills/stacked-prs/SKILL.md)). A blocker with
lower priority than what it blocks is a planning error: raise it or lower the blocked work.

## Which layer?

Work through it in order and stop at the first yes.

1. **Is it an outcome that several capabilities add up to, with one pass or fail done test?**
   Milestone.
2. **Is it a capability made of several related deliverables?** Epic.
3. **Can one person or agent finish it in a sprint with one pull request?** Issue. If not, split it
   until each piece can.
4. **For an issue:** does an epic already hold this capability? Make it a sub-issue of that epic.
   Is a capability starting, with more related issues foreseeable? Create the epic. Otherwise it
   sits in its milestone with no epic above it.
5. **Is it a step of an issue, separately assignable or checkable?** Sub-issue of that issue.
   Otherwise write it as a line in the acceptance criteria.
6. **Milestone for an epic:** does an open outcome milestone exist whose done test this epic helps
   pass? Assign it. If the epic is planned and none exists, propose a milestone. If not, it sits
   in the Backlog milestone.

## Anti-patterns

- **A milestone named for an activity** (a verb, "refactoring", "phase two"): it has no done test.
- **A milestone per sprint:** sprints are the board's iteration field, not outcomes.
- **An epic that is really an issue:** one child, or one pull request of work.
- **An issue that is really an epic:** bigger than one sprint, or needing several pull requests
  that each deliver something.
- **Labels that duplicate hierarchy:** a label for a milestone, an epic or a sprint.
- **Work under no layer.** Ongoing upkeep has no done state, so it sits in the Backlog milestone,
  never under an invented finish line.
- **Prose dependencies** and **a second scope list** in an epic body that drifts from the children.
- **Moving children between epics to group them,** and **dates that slide silently** when a
  milestone slips: change them with a comment that says why.

## Templates

Titles: a milestone states an outcome (`<Who> can <do what>`); an epic is a capability noun phrase;
an issue states the problem or deliverable with its type, as in the issue forms in
[`.github/ISSUE_TEMPLATE/`](../../.github/ISSUE_TEMPLATE/config.yml).

Milestone description:

```markdown
**Goal:** <one sentence: the outcome, for whom>
**In scope:** <the capabilities, one line each>
**Out of scope:** <what a reader might expect and will not get>
**Done when:** <observable checks, each pass or fail>
**Due:** <a date and its real reason, or omit the line>
```

Epic body:

```markdown
<A plain summary: what becomes possible, and for whom.>

**Out of scope:** <what this epic will not do>
**Done when:** <acceptance for the whole capability, beyond the children closing>
**Milestone:** <which outcome it serves, or Backlog until it is planned>
```

An issue's body follows the issue forms (problem, proposed fix, acceptance criteria, files likely
touched, must not touch, area, priority).

## Sources

Official GitHub Docs, read for this page (milestones, sub-issues, dependencies, iterations, issue
types and fields):

- Milestones: https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/about-milestones
- Milestone to issue, one value in the API: https://docs.github.com/en/rest/issues/issues
- Sub-issues, depth and limits: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues
- Sub-issue REST endpoint (`replace_parent`, same owner): https://docs.github.com/en/rest/issues/sub-issues
- Parent and sub-issue progress in projects: https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-parent-issue-and-sub-issue-progress-fields
- Dependencies (blocked by, blocking): https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies
- Iteration fields: https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-iteration-fields
- Issue types (organization): https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-types-in-an-organization
- Issue fields such as Priority and Effort (organization): https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization
- Issue fields, availability (organizations only): https://github.blog/changelog/2026-07-02-issue-fields-are-now-generally-available

Agile references:

- Atlassian, epics, stories and initiatives: https://www.atlassian.com/agile/project-management/epics-stories-themes
- The Scrum Guide (refinement, Definition of Done, Sprint Goal): https://scrumguides.org/scrum-guide.html
- INVEST for story size (Bill Wake): https://xp123.com/invest-in-good-stories-and-smart-tasks/

Where the docs are silent we say so rather than assert: they do not state in prose that an issue
has one milestone or one parent (the API shapes imply both), and they describe no automatic
carry-over of unfinished iteration items.
