# Watch list

What the team keeps an eye on, so a problem is seen the first time it repeats and not after it has
cost a week. The chief of staff reads it at the start of a session and in the
[sweep](grooming-playbook.md#the-sweep). The [feedback loop](agent-operating-model.md#7-the-feedback-loop)
turns what it finds into a fix. This page holds principles only: what to watch and where the signal
comes from, never a number or a threshold.

## How to use it

- **Symptoms first.** Report what is going wrong for the owner, a neighbor or an agent, then look
  for the cause. A cause with no symptom is a note, not an alarm
  ([Google SRE](https://sre.google/sre-book/monitoring-distributed-systems/)).
- **Repetition is the alarm.** One failure is work. The same failure again is a signal: a check
  that keeps failing, a review finding that keeps coming back, a question asked twice. Say it at
  the start of the session, in one line, with a count and where it was seen.
- **Judge the outcome, not the report.** An agent saying it is done is not evidence. The merged
  change, the live page and the moved card are
  ([Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)).
- **Speed and stability together.** More merged work means little if more of it has to be redone.
  Assistance from AI tends to raise both, so neither is read alone
  ([DORA](https://dora.dev/guides/dora-metrics/)).
- **Fix at the root, with the strongest tool that works:** a test or check, then a hook, then a
  written rule ([the loop](agent-operating-model.md#7-the-feedback-loop)).
- **Keep it small.** A signal nobody acts on is removed. A new one is added only after it would
  have caught something real.

Each row says who watches it today: **Check** (a tool fails by itself), **Chief of staff** (read
at the start of a session or in the sweep), or **Not yet** (nothing watches it; a gap to close
when it starts to hurt).

## Delivery

DORA's five measures, in this project's terms.

| Watch                                                              | Signal                                                                  | Today          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------- |
| How long an issue takes from In progress to merged                 | Issue and pull request dates                                            | Not yet        |
| How often a change reaches the live site                           | Deploy runs on `main`                                                   | Not yet        |
| A deploy that fails, and how long the site stays affected          | The deploy run, then [`wrapped`](../../.agents/skills/wrapped/SKILL.md) | Chief of staff |
| A merged change that needs a fix or a revert soon after            | A bug or revert linked to a recent pull request                         | Not yet        |
| Work redone: a reopened issue, a second pull request for one issue | Reopen events, pull requests per issue                                  | Not yet        |

## Agent work

| Watch                                                                          | Signal                                                 | Today          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ | -------------- |
| A check that rejects pull request after pull request                           | Failed workflow runs, counted by check                 | Chief of staff |
| The same review finding across pull requests                                   | Reviews and their findings                             | Chief of staff |
| Drift: a change outside the files its issue declared, or beyond its criteria   | The diff against the issue; the reviewer's scope check | Chief of staff |
| Done in words only: closed without a merge, criteria unchecked, card not moved | Issue state against its pull request and criteria      | Chief of staff |
| A claim with no progress: In progress, no comment, no pull request             | The sweep's stale check                                | Chief of staff |
| Two agents on the same thing: duplicates, overlapping files                    | The sweep and the overlap check                        | Chief of staff |
| The same blocker met again: "cannot reach", "no access", "not permitted"       | Issue and pull request comments                        | Chief of staff |
| Time a question waits for the owner                                            | Age of each `needs owner` item                         | Chief of staff |
| Usage per merged pull request, and work stopped by a usage limit               | The tool's own usage report                            | Not yet        |
| A check that fails and passes with no change (flaky)                           | Re-runs that turn green                                | Not yet        |

## Instructions and knowledge

| Watch                                                            | Signal                                            | Today   |
| ---------------------------------------------------------------- | ------------------------------------------------- | ------- |
| What every session loads at the start keeps growing              | The session-start token budget                    | Check   |
| The docs say one thing and the code does another                 | `Knowledge sync` and the pull request gate        | Check   |
| Two documents contradict each other, or a rule points at nothing | Link checks in tests; the reviewer; a doc audit   | Not yet |
| A rule that is always worked around, or never comes up           | Review findings and questions about the same rule | Not yet |
| A setup built for an older model's limits                        | Re-testing with and without it when models change | Not yet |

Each part of an agent setup is a guess about what a model cannot do alone, so it is re-tested as
models change ([Anthropic](https://anthropic.com/engineering/harness-design-long-running-apps)).
Guidance an agent must choose to open is often skipped, so what matters on every change stays in
what loads by itself and everything else stays out of it
([OpenAI](https://developers.openai.com/codex/learn/best-practices)).

## The plan

The sweep already covers duplicates, stale items, orphans, missing fields, wrong layer and
consistency ([grooming playbook](grooming-playbook.md#the-sweep)). Two more belong here:

| Watch                                   | Signal                                 | Today          |
| --------------------------------------- | -------------------------------------- | -------------- |
| Work carried over from sprint to sprint | The sprint field at rollover           | Chief of staff |
| An idea filed and never looked at again | Open issues with no activity or parent | Chief of staff |

## The live site

The four signals Google's SRE practice starts from, for a small site on one server.

| Watch                                                             | Signal                                        | Today   |
| ----------------------------------------------------------------- | --------------------------------------------- | ------- |
| Errors: pages or forms that fail                                  | Server logs; the live check after each deploy | Not yet |
| Slowness: how long a page takes for a neighbor on a phone         | A measured baseline, then a check against it  | Not yet |
| Traffic: visits, and what neighbors open                          | The visit counter                             | Not yet |
| Room left: disk, memory and processor on the server               | The backup's disk check; server facts         | Not yet |
| The site is down and nobody is looking                            | A check from outside the server               | Not yet |
| Stale content: an empty events list, a scout that stopped running | The pages themselves; the agents' run history | Not yet |
| Email that does not arrive: confirmations, contact form           | The mail provider's delivery report           | Not yet |

## Operations and safety

| Watch                                                           | Signal                                          | Today   |
| --------------------------------------------------------------- | ----------------------------------------------- | ------- |
| Backups run, and one has been restored on purpose               | The backup log; a dated restore on an issue     | Not yet |
| A package with a known flaw                                     | `Dependency Audit`, daily and on each change    | Check   |
| Dependency updates left open                                    | Age of open update pull requests                | Not yet |
| A secret in the repository, or one that is old or widely shared | Secret scanning; the date each was last changed | Not yet |
| A domain or certificate close to expiry                         | Registrar and server dates                      | Not yet |
| A limit of an outside service: mail sends, certificates, plan   | That service's usage page                       | Not yet |
| Access: who and what can change the site and its data           | Reviews of access rules, keys and roles         | Not yet |

## What the chief of staff says, and when

- **Start of session:** anything repeated since the last session, each in one line. Nothing
  repeated, nothing said.
- **In the sweep:** every row marked Chief of staff, as findings in the report. A row is marked
  that way only when the skill or the playbook has the step that reads its signal.
- **A gap that starts to hurt:** a row marked Not yet becomes an issue when its problem shows up
  for real, with the cheapest mechanical check that would have caught it.

## Sources

- DORA, software delivery performance metrics: https://dora.dev/guides/dora-metrics/
- Google SRE, monitoring distributed systems: https://sre.google/sre-book/monitoring-distributed-systems/
- Google SRE, postmortem culture: https://sre.google/sre-book/postmortem-culture/
- Anthropic, demystifying evals for AI agents: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Anthropic, harness design for long-running applications: https://anthropic.com/engineering/harness-design-long-running-apps
- OpenAI, Codex best practices: https://developers.openai.com/codex/learn/best-practices
