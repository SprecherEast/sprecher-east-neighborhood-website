# Knowledge eval

Measures whether the knowledge layer (decision [0019](../../docs/architecture/decisions/0019-knowledge-layer.md),
section 8) helps an agent: the same 8 tasks, run in a fresh `claude` session on two commits, then
compared on correctness and tokens. It is the eval behind #715. Run it again after notes are added
or changed (#719). This page is a how-to, not a module note, so it is not in the knowledge index.

## What it costs, and what it needs

- **About 32 sessions** for the default: 8 tasks, 2 conditions, 2 runs each. The change tasks
  (7 and 8) take 10 to 25 minutes each. It spends your Claude usage, so it is never run in CI.
- The `claude` CLI, signed in, and `node_modules` installed in the checkout you run it from.
- **`ANTHROPIC_API_KEY` must be unset.** With it set, every `claude -p` session bills the API
  instead of your plan, so the runner refuses to start. It also strips `GH_TOKEN` and
  `GITHUB_TOKEN` from what a session inherits.
- **Runs have no GitHub or web access.** The answers are posted on #715, so a run that could read
  them would be graded on what it found there. Don't loosen the lists in `claude.mjs` to run a
  task. How this is enforced, and where it stops:
  - The checkout's own `.claude/settings.json` allows `Bash(*)`, `Edit(*)`, `Write(*)` and
    `WebFetch(*)`, which a trusted workspace (your machine) applies. So the runner rewrites that
    file in each throwaway worktree: `permissions` become exactly `ALLOWED_TOOLS` and
    `DISALLOWED_TOOLS`, and the rest (hooks, plugins) stays as the commit has it. Sessions start
    with `--setting-sources project`, so your user settings don't apply either. `CLAUDE.md` and
    `.claude/rules/` still load; that is what condition B measures.
  - The deny list blocks `gh`, `curl`, `wget`, `WebFetch`, `WebSearch`, shells and interpreters
    (`node`, `bash`, `python`), git routes to a remote (`push`, `fetch`, `-c`, `remote`), package
    installs and no commit. Everything not allowed by name is refused, because a `-p` session
    can't ask.
  - `Edit` and `Write` are not in the allow list: `acceptEdits` lets them change files inside the
    worktree only (checked against the CLI: a write outside was refused).
  - **The limit:** this is the CLI's permission system, not an operating-system sandbox. An
    allowed command such as `npx vitest` runs project code with your network. For a hard
    guarantee, run it in a container without network.

## Run it

```bash
# A = before the knowledge layer (#144), B = with it. Any two commits work.
node scripts/knowledge-eval/run.mjs --a aa0bd3d --b <commit> --out /tmp/eval-1

# Options: --runs 2 (per task and condition), --tasks 1,3 (a subset), --jobs 1 (parallel
# sessions), --model sonnet, --effort medium
node scripts/knowledge-eval/analyze.mjs /tmp/eval-1 --answers
```

`run.mjs` makes a throwaway worktree for each run (in the system temp folder), starts
`claude -p` in it with the prompt on stdin, records the transcript, then runs the grading commands
for the change tasks and deletes the worktree. It prunes stale worktrees first and refuses to
start a session unless the folder is the root of a real checkout with an `AGENTS.md`: a run once
fell back to the scratch folder and answered from nothing. Nothing is pushed. On Ctrl-C or a
kill, the runner stops the sessions and removes the worktrees (a `SIGKILL` can't be caught: the
next run's `git worktree prune` and your temp folder clean up).

`analyze.mjs` prints the two tables for the `### [DECISION]` comment on the issue: tokens per task
(mean of the runs, with tool calls and files read) and correctness, then the gate line (B must not
score lower on any task, and use fewer tokens on at least 5 tasks; `--min-faster N` changes the 5).
`--answers` also prints every answer with the facts the key did not find.

## The task set

`tasks.json`: each task has a `prompt` (the same in both conditions) and a `kind`.

- **question**: a `key`, a list of required facts. A fact is a list of alternative spellings, found
  by a case-insensitive text match, or `/regex/`. Full when all are found, half when at least half,
  else none. Facts that are numbers are written as patterns that pair each number with its
  setting (task 4: `days … 1 … 31 … 7`), so swapped bounds fail. This is a mechanical first pass. **Read the answers** (`--answers`): it can't tell a
  wrong answer that mentions the right words, or a hedge.
- **change**: `commands` that must pass in the finished worktree (run by `run.mjs`; a command may
  list `tolerate`d errors: only a `TS2307` naming a module that is already missing on the commit,
  such as the two seed images), `mustChange` (regular expressions that must each match a changed
  file) and `mustContain` (a pattern that must appear in a changed file whose path matches, read
  back after the run: task 7 needs `max: 8` in the `limit` bounds of `thisWeek.ts`, so a wrong
  value fails even with green tests). **Still a human read of `<out>/<run>.diff`:** that the
  number is defined in one place with no copy elsewhere, that the new test covers 8, and for task
  8 the guard rails (the UI kit, no `@/payload-types` in `ui/`, `generate:types` run).

Measures are per run totals (all tokens including cache, tool calls, distinct files read). Unlike
the issue's wording, they are not cut at the first correct edit.

## Files

| File                                        | Role                                                   |
| ------------------------------------------- | ------------------------------------------------------ |
| `run.mjs`                                   | Starts the sessions (thin: processes and files only)   |
| `analyze.mjs`                               | Reads the results folder, prints the tables            |
| `claude.mjs`, `options.mjs`                 | The allowed tools, the arguments, the checkout guard   |
| `transcript.mjs`, `grade.mjs`, `report.mjs` | Parse, grade and total (pure, with tests)              |
| `tasks.mjs`, `tasks.json`                   | The task set                                           |
| `fixtures/`                                 | Trimmed real transcripts from the pilot, for the tests |
