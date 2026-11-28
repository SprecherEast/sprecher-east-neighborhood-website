# CLAUDE.md — Claude Code adapter

Claude Code reads this file automatically. It connects Claude Code to the repo's tool-neutral
guidance and holds only what the other tools don't need. Rules, procedures and facts go where
[where knowledge lives](docs/guidelines/where-knowledge-lives.md) says, so every agent sees them.

Loaded into every session, so keep it short (`npm run agent-context` fails over its token budget, #144, #737):

@AGENTS.md

What is specific to Claude Code (skill pointers, self-review, models and effort, unattended runs,
hooks, plugins, the generated rule copies, built at session start and not in git) is in
`.claude/rules/claude-code-setup.md`; it loads when the work touches `CLAUDE.md`, `.claude/`,
`.agents/` or `.github/`. Every guideline and module note loads when the work reads or edits a
matching file.
