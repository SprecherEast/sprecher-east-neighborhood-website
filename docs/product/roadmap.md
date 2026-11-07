# Roadmap

What the site is working toward, in order. The [vision](vision.md) says why. **GitHub holds the
live status:**

- **Milestones:** dated outcomes.
- **Epics:** issues labeled `epic`, with their sub-issues.
- **[The project board](https://github.com/users/boulaajaj/projects/2):** the current sprint. It's
  private, so only the owner's account can open it.

This file lists only the milestones and their epics, as a snapshot. GitHub is the source: this
command prints the open epics by milestone, and the tables below must match it. Update the tables
when an epic is added, rescheduled or finished, not as work moves. How the levels fit together is in
[how we work](../process/project-management.md).

```bash
gh api "repos/{owner}/{repo}/issues?labels=epic&state=open&per_page=100" \
  -q 'sort_by(.milestone.due_on // "9999") | .[] | "\(.milestone.title // "No milestone")\t#\(.number) \(.title)"'
```

## Milestone 1: Ready for neighbors (due 2026-11-30)

[Milestone on GitHub](https://github.com/boulaajaj/sprecher-east-neighborhood-website/milestone/1)

The site is useful and inviting enough to promote across the neighborhood.

| Epic                                                                                                                     | Outcome                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [#161](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/161) News, events and city council updates | A resident can find this week's events, the latest civic update and the forum in one click.                           |
| [#162](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/162) Get involved                          | A resident can sign up to help, on a phone, in under two minutes.                                                     |
| [#163](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/163) Shared component library              | Every screen in this milestone is built from one tested set of components, chosen from an inventory of the live site. |
| [#169](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/169) Owner actions                         | Everything that needs the owner's login, money or decision is done or decided.                                        |

## No milestone

| Epic                                                                                                                        | Why it has no milestone                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [#164](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/164) Photo contest                            | Not scheduled yet. Email confirmation (#183), which it needed, is done.                                                        |
| [#127](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/127) Reorganize the code into modules         | Under way. Foundation work, done step by step alongside the milestones.                                                        |
| [#181](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/181) Keep the site safe and running           | Ongoing upkeep: server, backups and dependencies.                                                                              |
| [#182](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/182) Agents stay inside the rules             | Ongoing: guardrails, lean agent context and review checks.                                                                     |
| [#190](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/190) A new design for the site                | Later. The pluggable themes (#146) and the component inventory (#170) it waited on are done; it gets a milestone when planned. |
| [#309](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/309) Self-service accounts and contact        | Residents sign up, sign in and contact the association without friction.                                                       |
| [#270](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/270) Use what's built in                      | Under way: our own code goes only into events, news and community.                                                             |
| [#444](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/444) Tools that check our rules automatically | Ongoing: machines check the rules on every change.                                                                             |
| [#712](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/712) Knowledge layer                          | Under way, first: an index, notes next to the code and generated reference, kept in sync with the code by a required check.    |
| [#685](https://github.com/boulaajaj/sprecher-east-neighborhood-website/issues/685) Chief of staff agent team                | After the knowledge layer: one agent to talk to, one worker per issue, a fresh reviewer per pull request.                      |

New ideas start as GitHub issues: a new capability as an epic, anything smaller under the epic it
belongs to. An epic gets a milestone when it's planned.
