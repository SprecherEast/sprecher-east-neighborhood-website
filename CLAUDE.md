# CLAUDE.md — Claude Code adapter

Claude Code reads this file automatically. It connects Claude Code to the repo's tool-neutral
guidance and adds only what is specific to Claude Code. Rules, procedures and facts go where
[`AGENTS.md`](AGENTS.md#where-knowledge-lives) says, so every agent sees them.

Loaded into every session, so keep it short (`npm run agent-context` fails over its token budget, #144, #737):

@AGENTS.md
@docs/guidelines/guard-rails.md
@docs/knowledge/index.md

Every other guideline, `docs/project.md` and `docs/process/project-management.md` load by
themselves when the work reads or edits a matching file: `.claude/rules/generated/` holds a copy of
each, made from the load map in [`docs/guidelines/README.md`](docs/guidelines/README.md). Edit the
reference or the map, never the copy, then run `npm run agent-context -- --write`. The setup notes
(agent team, unattended runs, subagents, hooks, plugins) are `.claude/rules/claude-code-setup.md`;
they load when the work touches `CLAUDE.md`, `.claude/`, `.agents/` or `.github/`.

## Claude Code specifics

- **Skills:** each `.claude/skills/<name>/SKILL.md` points to `.agents/skills/<name>/SKILL.md`
  (`simplify` is the one alias, below). Edit that copy. A new skill gets a pointer too, with the
  same `name` and `description`.
- **Self-review:** `/simplify` and `/self-review` both run this repo's
  [`self-review`](.agents/skills/self-review/SKILL.md), with its reviews as parallel subagents. The
  project `simplify` replaces Claude Code's generic built-in one and also runs before each commit
  that isn't docs or tests. Run it again before opening or updating a PR.
- **After every merge,** run `/wrapped` (the [`wrapped`](.agents/skills/wrapped/SKILL.md) skill).
- **Independent review:** run [`pr-review`](.agents/skills/pr-review/SKILL.md) in a separate
  session or a new subagent (for example `qa-reviewer`), never in the context that wrote the change.
- **Models and effort** (#522): other sessions start on `opusplan` at `medium` effort, and the agents in
  `.claude/agents/` on `sonnet` at `medium`. Start the reviewer on `opus` at `high` only when the PR
  touches sign-in or accounts, access rules, migrations, the deploy or server scripts, or other
  security code. Fallback reviewer: `sonnet[1m]`, `medium`. Use the plain aliases, never a version. Never `fable` in unattended runs.
- **Unattended runs:** never `--dangerously-skip-permissions`, and keep `ANTHROPIC_API_KEY` out of
  the environment (it switches `-p` runs to API billing). Details in `claude-code-setup.md`.
- **Waiting for checks:** poll `gh pr checks <number>` in the background (`run_in_background`),
  about once a minute and for at most 15 minutes, without pushing; after that, tell the user.
- **Browser and dev server:** `.claude/settings.json` allows the Playwright MCP tools used for
  screenshots, and `.claude/launch.json` starts `npm run dev`.
