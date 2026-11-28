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

- **Skills:** each `.claude/skills/<name>/SKILL.md` points to `.agents/skills/<name>/SKILL.md`
  (`simplify` is the one alias, below). Edit that copy. A new skill gets a pointer too, with the
  same `name` and `description`.
- **Self-review alias:** `/simplify` and `/self-review` both run this repo's
  [`self-review`](/.agents/skills/self-review/SKILL.md), with its reviews as parallel subagents.
  Because a project `simplify` skill exists, Claude Code runs it, replacing its generic built-in
  one, before each commit that isn't docs or tests (Claude Code v2.1.286 or later; a personal
  `~/.claude/skills/simplify` would win over it). Run it again before opening or updating a PR.
- **Models and effort** (#522): other sessions start on `opusplan` at `medium` effort, and the agents in
  `.claude/agents/` on `sonnet` at `medium`. Start the reviewer on `opus` at `high` only when the PR
  touches sign-in or accounts, access rules, migrations, the deploy or server scripts, or other
  security code. Fallback reviewer: `sonnet[1m]`, `medium`. Use the plain aliases, never a version.
  Never `fable` in unattended runs.
- **Independent review and wrap-up:** run [`pr-review`](/.agents/skills/pr-review/SKILL.md) in a
  separate session or a new subagent (for example `qa-reviewer`), never in the context that wrote the
  change. After every merge, run [`wrapped`](/.agents/skills/wrapped/SKILL.md).
- **Waiting for checks:** poll `gh pr checks <number>` in the background (`run_in_background`),
  about once a minute and for at most 15 minutes, without pushing; after that, tell the user.
- **Browser and dev server:** `.claude/settings.json` allows the Playwright MCP tools used for
  screenshots, and `.claude/launch.json` starts `npm run dev`.
- **Agent team** ([operating model](/docs/process/agent-operating-model.md), #685, #721). The chief
  of staff is built (#695 piece one): `.claude/agents/chief-of-staff.md`, run with
  `claude --agent chief-of-staff`, on `opus` at `high` effort, with `disallowedTools` for Edit,
  Write, NotebookEdit, MultiEdit, push, merge, `PUT` API calls and GraphQL mutations (known
  holes are in the [manual test](/docs/process/chief-of-staff-manual-test.md)), and `Agent(worker, qa-reviewer, outsider-reviewer)` as
  the only agents it may start. `.claude/settings.json` names it as the default agent (`agent`), so a session in the project starts as the chief of staff; `--agent` overrides it. The worker agent (`.claude/agents/worker.md`) does each issue; the reviewer stays
  on `sonnet` at `medium`. Its helper procedures are skills, so they run in its session and need no model of
  their own. Review depth today is the models and effort rule above and nothing wider. Never `fable` in
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
- **Subagents:** `.claude/agents/` holds only the chief of staff, the `worker`, the reviewer
  (`qa-reviewer`) and the outsider reviewer, each pointing at its skill or [role guide](/docs/roles/README.md)
  (the chief of staff and the outsider reviewer work from their skills); edit that, not the
  agent file. Other role guides load by name through the brief, not as agents. The `worker` does each
  issue. A headless `-p` run in the project also starts as the chief of staff; no workflow does.
- **Hooks** (#446, in `.claude/settings.json`, scripts and tests in `.claude/hooks/`): at session
  start, `session-start.mjs` shows the short process reminder (#1300). Before a Bash command that
  creates an issue (`gh issue create`, or a `gh api` POST to the issues endpoint), the issue rules
  and the duplicate-search record are checked and the command refused when it would fail
  ([the rules](../../docs/process/issue-and-pr-checks.md#where-the-rules-run-before-the-check-does)).
  After each
  Edit or Write, the file is formatted with Prettier and checked with ESLint in the checkout or
  worktree that holds it, and an error comes back to fix at once. If the file is one a knowledge
  note describes (`docs/knowledge/map.json`) and that note has no change compared with `main`, a
  reminder follows, once per module per session. For any other file the classifier calls
  behavior-bearing (`scripts/behavior-change.mjs`, by path), while no doc has changed compared
  with `main`, one repository-wide reminder follows, once per session (#770). Neither blocks
  (#717; the rule is in `AGENTS.md`, the skills and CI). It compares with `main`, so it is quiet in a shallow clone and does not see a
  note a lower PR in a stack changed. Before each Bash command, the
  commands the [`change-workflow`](/.agents/skills/change-workflow/SKILL.md#the-path-to-main) path forbids (`--admin`, `bypass_rules: true`, a push to `main`) are refused, and
  so is a commit whose `src/payload-types.ts` change is only `next dev` reformatting it. Before a
  browser script runs (`javascript_tool` of any browser MCP), one that writes to `/api/media`, or writes an
  image field (`heroImage`, `image`) through any `/api/` route or GraphQL, is refused unless it carries `image-review: passed`, which says the
  [image review](/docs/guidelines/images.md) was done (#812); the
  hook can't judge the image, the review does, and it doesn't see the `file_upload` browser tools or
  the admin UI. CI stays
  the real gate. Hooks run in local and cloud sessions alike.
- **Security plugin:** `.claude/settings.json` turns on Anthropic's `security-guidance` plugin,
  which reviews Claude's changes for security mistakes as it works. Local sessions install it once
  with `claude plugin install security-guidance@claude-plugins-official --scope project` (it needs
  Python 3.8+). Cloud sessions don't load plugins a repository turns on, so there CodeQL and the
  reviews cover it.
- **How instructions load** (#144): a rule in
  `.claude/rules/` with `paths` loads when Claude reads or edits a matching file, and one without
  `paths` loads at session start. An `@import` inside a rule loads at session start whatever the
  rule's `paths` say, so the generated rules carry the text itself. Never edit a copy in `.claude/rules/generated/`: edit the reference or the load map in
  `docs/guidelines/README.md`, then run `npm run agent-context -- --write`. Symlinked rules work, but git
  on Windows checks symlinks out as plain text unless symlinks are enabled, so they aren't used.
- **Generated rules are build output, not in git** (#1593): `.claude/rules/generated/` is ignored, so
  an edit to a guideline or note is one edit and conflicts once. The `session-start.mjs` hook builds
  the folder with `scripts/agent-context-rules.mjs`, which needs no `npm ci`, for the project
  directory and for the checkout the session works in (the hook input's `cwd`), so a fresh clone and
  a worktree have the rules before the first file is read; it rewrites only a file that changed, so a
  pull refreshes them. `npm run agent-context -- --write` builds them by hand. CI (`Agent context`)
  builds them in memory, keeps the load maps sound and keeps the session-start budget. What Claude
  Code resolves in a worktree, from its [worktree](https://code.claude.com/docs/en/worktrees)
  docs: a subagent with `isolation: worktree` takes the instructions it starts with from the main
  conversation, and in the default location (`.claude/worktrees/`) it does not load that worktree's
  own `CLAUDE.md` or `.claude/rules/` as it reads files there, so it uses the rules of the checkout
  the session started in, which the hook refreshed at session start. Hooks keep
  `${CLAUDE_PROJECT_DIR}` at the project root, so the hook also builds for the `cwd` it is given. A
  worktree made by hand (`git worktree add`) is covered when a session starts in it; a worker that
  makes one mid-session runs `npm run agent-context -- --write` there once.
