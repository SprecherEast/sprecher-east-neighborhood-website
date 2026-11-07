# 0019: A knowledge layer of short notes and generated reference, kept in sync by CI

- **Date:** 2026-11-06
- **Status:** Accepted
- **Issue:** #713, under the knowledge-layer epic #712

## Context

Every session, agent or person, works out again how the site is put together: which screens exist,
what each content type holds, which shared components a page uses, where each piece of data comes
from. That costs tokens, and two sessions can reach two answers. Summary of the owner's direction
(2026-11-04, voice session; 2026-11-06, Claude session, text; recorded on #712):

- The knowledge layer comes before the agent team, serves agents and people alike, and documents
  screens, content types and common components, with where data comes from.
- It follows Andrej Karpathy's method, open standards and progressive disclosure, with sources.
- When code changes behavior (a content type's behavior, its properties or its events), the
  documentation changes in the same PR; the review always checks; a PR out of sync is blocked.
- Pilot on one module, measure, then roll out (agreed 2026-11-06).

What the evidence says, and what it rules out:

- **Overviews don't help by themselves.** Context files did not raise task success on average and
  cost over 20% more; repository overviews did not help agents find the right files sooner; files a
  model wrote gave no gain ([ETH Zurich, 2026](https://arxiv.org/abs/2602.11988)). So a note holds
  only what the code can't show, and facts the code can show are generated from it.
- **A small index beats knowledge the agent must choose to open.** An always-loaded compact index
  passed every eval; skills were not opened in 56% of runs
  ([Vercel, 2026](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)).
- **Instructions are context, not enforcement**
  ([Claude Code](https://code.claude.com/docs/en/memory)). Sync is a CI check, not a sentence.
- **What loads when** was tested in #144: a rule with `paths` loads when a matching file is read
  or edited; the generator `scripts/agent-context.mjs` already turns a table into such rules.

## Decision

### 1. The method

Karpathy's LLM wiki ([gist, 2026](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f))
has raw sources that are never edited, a wiki the model keeps current, and a schema; an index read
first; "ingest" of new material into the pages it touches; a periodic "lint". He wrote it for
personal knowledge bases, so this is an adaptation:

| His term    | Here                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------ |
| Raw sources | The code, the Payload config and the decision records. The layer never restates them       |
| Wiki        | The notes (written) and the reference (generated from the sources)                         |
| Schema      | This record, `docs/knowledge/note-template.md`, and "Where knowledge lives" in `AGENTS.md` |
| `index.md`  | `docs/knowledge/index.md`, the only part loaded into every session                         |
| `log.md`    | Git history and the PRs; no extra file                                                     |
| Ingest      | Each PR updates the notes its diff touches (the sync rule, §6)                             |
| Lint        | A scheduled check for stale, orphaned or broken notes (#720)                               |

The parts follow the [Diátaxis](https://diataxis.fr/) split: the generated pages are **reference**,
the notes are **explanation**, the skills are **how-to**. Every file is plain Markdown readable by any
agent and any person; instructions follow [AGENTS.md](https://agents.md/), procedures
[Agent Skills](https://agentskills.io), reasons these records
([Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).

### 2. Three levels, loaded progressively

1. **Index**, `docs/knowledge/index.md`, at most 25 lines: one line per note and per reference
   section, kept small because it loads every session (#713 asked for under 80; 25 fits the
   session-start token budget of #144 and #737 with room). #715 imports it in `CLAUDE.md` with the
   first note;
   `AGENTS.md` points to it for Codex and people.
2. **Notes**, next to the code, at most 80 lines each (§3). Each loads by itself when the work reads
   or edits a file under its paths: `scripts/agent-context.mjs` generates a path-scoped rule from
   the knowledge map (§5), as it does for the guidelines. #715 extends the script to read the map.
3. **Reference**, `docs/reference/`, generated (§4). Read on demand: a note links its pages.

Below level 3 is the code itself, which stays the source of truth.

### 3. Notes

- **Where:** `src/modules/<name>/README.md` for each module, and one for each shared area of
  `src/platform/`. A module too big for 80 lines (`site`) gets a second note in a subfolder.
- **What:** the sections of [`note-template.md`](../../knowledge/note-template.md): purpose, screens
  and where each one's data comes from, behaviors and events the config doesn't show, shared pieces
  used, rules with the test that protects each, boundaries, decisions, known gaps.
- **What not:** no field lists, props tables or route lists (the reference has them), no history
  (git and the decision records have it), nothing the reader learns faster from the code.
- **Written, not generated.** A person or an agent writes each sentence and traces it to a file or a
  test. A model may draft, but nothing merges that hasn't been checked against the code.

### 4. Generated reference

Generated by scripts, never edited by hand, regenerated and compared in CI (`Knowledge sync`). Each
page starts with a line saying it is generated and how to regenerate it.

| Reference                 | Source                                                              | Built in |
| ------------------------- | ------------------------------------------------------------------- | -------- |
| Content types and globals | The loaded Payload config, plugins included                         | #714     |
| Screens (routes)          | The `src/app/(frontend)/` tree and each route's entry imports       | #718     |
| Shared components         | `src/platform/ui/` and the shared parts of `src/platform/richtext/` | #718     |
| UI element coverage       | The "Target component · variant" column of `docs/ui/elements-*.md`  | #495     |

What each step of the [native-first ladder](../../guidelines/development.md#native-first-then-plugins-then-our-code)
found (2026-11-06, recorded on #713):

- **Content types.** Native: `payload` exports `configToJSONSchema` (behind `generate:types`) and the
  config loads without a database (`loadConfig` in `src/platform/payload/testing/accessHarness.ts`).
  Official plugins: none writes documentation of the schema. Third party: the one "Payload docs"
  package found ([`@valkyrianlabs/payload-markdown-docs`](https://www.pkgstats.com/pkg:@valkyrianlabs/payload-markdown-docs),
  one maintainer) renders a docs folder inside Admin; it doesn't document the schema. **So:** our
  script reads the loaded config (access and hooks are functions, which JSON Schema drops).
- **Routes.** Native: `next typegen` writes route types into `.next/types`, for the compiler, not a
  readable list ([Next.js](https://nextjs.org/docs/app/api-reference/config/typescript)). **So:** our
  script walks `src/app/(frontend)/`; it can cross-check against the generated types.
- **Components.** Native: the TypeScript compiler, already installed. Established:
  [`react-docgen-typescript`](https://www.npmjs.com/package/react-docgen-typescript) (MIT, about
  5.9 million downloads a week). #718 picks between them; the `/dev/gallery` page stays the visual
  reference.

### 5. The knowledge map

`docs/knowledge/map.json` lists every note with the path patterns it describes:
`[{ "note": "src/modules/events/README.md", "paths": ["src/modules/events/**"] }]`. One list, read by
three tools: the loader (§2), the sync check (§6) and the stale check (#720). #715 creates it with
the events entry, #716 reads it, and each note of #719 adds its entry with its first commit.

### 6. The sync rule

**A behavior change** is anything a visitor, an editor or an agent would see or get differently: a
screen, a message, a content type's fields, access or hooks, a route, an email, a job or another
event, a limit or a time window, a module's entry file. **Not one:** a refactor that keeps behavior,
tests, comments, formatting, dependency patches with no behavior change.

- **In the PR:** the template gets a **Knowledge** section with one line, `Behavior change: yes`
  and what changed, or `Behavior change: none` and why.
- **Blocking check** (#716, widened by #770, in `PR Policy`, already required): it covers the
  whole repository, and a mapped path no longer decides whether a PR is checked (owner,
  2026-11-06, Claude Code voice session relayed in text, #770). A PR that changes anything that can
  alter behavior must change a note, a reference or a doc, or declare `Behavior change: none` with
  a reason of at least 20 characters. Where `map.json` names a note for a changed path, that note
  itself must change (or the declaration is made). The reviewer verifies the declaration against
  the diff; a false one is a Blocker.
- **What the check skips, and what it asks for.** One classifier decides, in
  `scripts/behavior-change.mjs` (shared with the hook), file by file, from the path and GitHub's
  diff. Skipped: tests, specs, fixtures and end-to-end files; docs (Markdown, `docs/`), which
  also satisfy the check when they change; lockfiles; the generated `src/payload-types.ts`;
  `package.json` when only dependency patch versions move; a diff of only comments or only
  formatting (whitespace, line breaks, quotes, semicolons, trailing commas). Everything else is
  behavior-bearing: source, scripts, workflows, `ops/`, config, migrations, assets, and any move
  or deletion of them. Unsure means required: a missing or unreadable diff, a trailing comment, a
  reordering, or a `*` line outside a visible block comment counts as behavior, because missing a
  real change is the worse failure. A pure refactor can't be told from a change, so it declares
  `none`. The rules are in that one file and tested in its test.
- **Generated reference:** `Knowledge sync` regenerates it and fails on a difference (#714, #718),
  so a content type, a route or a component can't change without its page.
- **Before and during the work** (#717): `write-code` reads the note first and updates it after; the
  self-review and `pr-review` list every behavior change and find the sentence that now describes
  it. A Claude Code hook reminds (once per session, for any file the classifier calls
  behavior-bearing while no doc has changed on the branch, and once per module for a mapped note),
  CI blocks.

No tool can decide with certainty whether a diff changes behavior. The check makes silence
impossible; the judgment stays with the author and the reviewer.

### 7. What already exists

Every `.md` under `docs/` (except `docs/knowledge/`, which this record creates) and every
`README.md` under `src/`, checked on 2026-11-06 at `aa0bd3d`:

| Files                                                                                           | Verdict                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `architecture/README.md`, `conventions.md`, `glossary.md`, `agent-access.md`, `review-queue.md` | Keep. The notes link to them                                                                                            |
| `architecture/data-model.md`                                                                    | Keep the reasons, relations and hooks; its field lists are replaced by the reference (#714)                             |
| `architecture/decisions/` (0001 to 0018, and the index)                                         | Keep, as history of reasons                                                                                             |
| `guidelines/` (12 files and `frontend-patterns/`, 5 files)                                      | Keep. They load by path since #144. Open drift: #279, #517, #531                                                        |
| `process/`, `product/`, `project.md`                                                            | Keep                                                                                                                    |
| `roles/` (README and 12 guides)                                                                 | Keep; they become skills in #695. Open drift: #158, #366                                                                |
| `ui/component-set.md`                                                                           | Keep its rules and decided choices; its props tables are replaced by the reference (#718)                               |
| `ui/component-set-modules.md`, `ui/data-types.md`                                               | Fold into the module notes (#715, #719), then mark as dated snapshots                                                   |
| `ui/inventory.md`, `evidence.md`, the three `elements-*.md`, `screenshots/`                     | Keep as the dated snapshot they already say they are (`e887427`); routes move to the reference (#718). Open drift: #495 |
| `memory/` (`MEMORY.md`, `progress.md`, `next-session-plan.md`, `vps.md`, `retro/sprint-2.md`)   | History. Two already say so; the other three get the same line (#725)                                                   |
| `custom-skill-proposal.md`, `sprint-2-tasks.md`, `sprint-3-backlog.md` (Feb–Mar 2026)           | History: move into `memory/` with the same line (#725)                                                                  |
| `src/modules/README.md`, `src/platform/README.md`                                               | Keep as the folder entry; they link to the notes. Both miss areas (#725)                                                |

New contradictions found while checking, filed as #725: `docs/project.md`'s folder tree misses the
`verification` module and `platform/service`; `src/modules/README.md` misses `agents` and
`verification`; `src/platform/README.md` misses `richtext`, `seo`, `service` and `turnstile`.

### 8. How the pilot is measured (#715)

The owner chose this eval (2026-11-06, Claude session, text, recorded on #712 and #715).

- **Tasks:** 8, written and posted on #715 before the note exists, each with a known answer or a
  test that grades it. At least 5 are on the events module (a "find and explain", a rule change in
  `domain/`, a new field through `cms/`, the mapper and a component); the rest are on content types
  the generated reference (#714) covers.
- **Conditions:** two. `main` before #144, at `aa0bd3d` (no path-scoped rules, no knowledge layer),
  and `main` with the knowledge layer (the index, the note, the map and the generated rule).
- **Runs:** 2 per task per condition (32 in all), each in a fresh session at the same model and
  effort, in a throwaway worktree that is never pushed.
- **Measures, for each run:** tokens, tool calls and files read before the first correct edit,
  whether the task was done correctly (graded by its answer or test), and any wrong turn.
- **Gate:** the rollout goes ahead if correctness doesn't drop and tokens fall on at least 5 of the
  8 tasks. Otherwise the template is revised once and measured again, or the owner is told.

## Consequences

- **Easier:** an agent working on a module gets its note without asking; a reviewer and the chief
  of staff read the index and the reference instead of the code; facts that can be generated can't
  drift.
- **Harder:** every behavior change costs a note edit, and the PR says whether behavior changed.
- **Risks:** notes that restate the code (the template and the 80-line cap guard it); a check
  people satisfy with a stock "none" (the reviewer's duty and a Blocker guard it); the index growing
  past its share of the budget (the budget check guards it).

## Links

#712 (epic), #144 (what loads when), #714 to #720 (the steps), #725 (drift found here), #685
(the agent team that reads this layer), #95 (an earlier code graph, closed).
