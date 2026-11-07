---
paths:
  - 'CLAUDE.md'
  - '.claude/**'
  - '.agents/**'
  - '.github/**'
---

# Claude Code setup notes

Part of the Claude Code adapter, moved out of `CLAUDE.md` so it loads only when the work touches the
adapter, the skills or the workflows (#144). Like `CLAUDE.md`, it holds only what is specific to
Claude Code.

- **Self-review alias:** because a project `simplify` skill exists, Claude Code runs it before each
  commit that isn't docs or tests (Claude Code v2.1.286 or later; a personal
  `~/.claude/skills/simplify` would win over it).
- **Agent team** ([operating model](/docs/process/agent-operating-model.md), #685, #721). Planned
  (#695, after the knowledge layer, #712): the chief of staff will run on `opus`, at `high` effort
  for grooming and issue text, and the one worker and standard reviewers stay on `sonnet` at
  `medium`. Its helper procedures are skills, so they run in its session and need no model of
  their own. Review depth today is the #522 rule in `CLAUDE.md` and nothing wider. Never `fable` in
  unattended runs: it can bill to usage credits, and in `-p` runs without asking
  ([model config](https://code.claude.com/docs/en/model-config)). Gotchas from the subagent docs:
  `isolation: worktree` branches from the default branch, not the parent's `HEAD`; the
  `Agent(name, …)` limit on `tools` and `initialPrompt` apply only to an agent run as the main
  session (`claude --agent`) ([subagents](https://code.claude.com/docs/en/sub-agents)). A reviewer
  is a new, non-forked subagent, so it starts with no memory of the change.
- **Unattended runs** (#694): the owner's computer runs Windows 11, where the built-in sandbox runs
  commands unsandboxed; it needs WSL2 ([sandboxing](https://code.claude.com/docs/en/sandboxing)).
  So a headless run uses `--permission-mode dontAsk` with an exact `--allowedTools` list (the
  documented pattern for CI). `.claude/settings.json` allows `Bash(*)`, `Edit(*)` and `Write(*)`,
  and a run in the project inherits them, so an unattended run needs its own settings without
  those wildcards, and a test that an unlisted command is refused (#697) before the setup is
  trusted. Never use `--dangerously-skip-permissions`, which is for containers and VMs only
  ([permission modes](https://code.claude.com/docs/en/permission-modes)). A WSL2 sandbox is an
  option the owner decides in #697. Keep `ANTHROPIC_API_KEY` out of the environment: in `-p` runs
  the key is always used when present, which switches usage from the subscription to API billing
  ([authentication](https://code.claude.com/docs/en/authentication)).
- **Subagents:** `.claude/agents/` registers each [role guide](/docs/roles/README.md) as a subagent
  Claude Code can delegate to. Those files only hold Claude Code settings; edit the guide. #695
  replaces them with one worker that loads the guides as skills.
- **Hooks** (#446, in `.claude/settings.json`, scripts and tests in `.claude/hooks/`): after each
  Edit or Write, the file is formatted with Prettier and checked with ESLint in the checkout or
  worktree that holds it, and an error comes back to fix at once. If the file is one a knowledge
  note describes (`docs/knowledge/map.json`) and that note has no change compared with `main`, a
  reminder follows, once per module per session. For any other file the classifier calls
  behavior-bearing (`scripts/behavior-change.mjs`, by path), while no doc has changed compared
  with `main`, one repository-wide reminder follows, once per session (#770). Neither blocks
  (#717; the rule is in `AGENTS.md`, the skills and CI). It compares with `main`, so it is quiet in a shallow clone and does not see a
  note a lower PR in a stack changed. Before each Bash command, the
  commands `AGENTS.md` forbids (`--admin`, `bypass_rules: true`, a push to `main`) are refused, and
  so is a commit whose `src/payload-types.ts` change is only `next dev` reformatting it. CI stays
  the real gate. Hooks run in local and cloud sessions alike.
- **Security plugin:** `.claude/settings.json` turns on Anthropic's `security-guidance` plugin,
  which reviews Claude's changes for security mistakes as it works. Local sessions install it once
  with `claude plugin install security-guidance@claude-plugins-official --scope project` (it needs
  Python 3.8+). Cloud sessions don't load plugins a repository turns on, so there CodeQL and the
  reviews cover it.
- **How instructions load** (#144): a rule in
  `.claude/rules/` with `paths` loads when Claude reads or edits a matching file, and one without
  `paths` loads at session start. An `@import` inside a rule loads at session start whatever the
  rule's `paths` say, so the generated rules carry the text itself. Symlinked rules work, but git
  on Windows checks symlinks out as plain text unless symlinks are enabled, so they aren't used.
