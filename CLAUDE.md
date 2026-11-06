# CLAUDE.md — Claude Code adapter

Claude Code reads this file automatically. It connects Claude Code to the repo's tool-neutral
guidance, which applies to every agent and human, and adds only what is specific to Claude Code.
Don't add rules, procedures or facts here: they go where
[`AGENTS.md`](AGENTS.md#where-knowledge-lives) says, so every agent sees them.

Loaded into every session:

@AGENTS.md
@docs/project.md
@docs/process/project-management.md
@docs/guidelines/guard-rails.md
@docs/guidelines/development.md
@docs/guidelines/security.md
@docs/guidelines/payload-cms.md
@docs/guidelines/nextjs-tailwind.md
@docs/guidelines/components-and-content.md
@docs/guidelines/ui-ux-design.md

Read the other guidelines (frontend patterns, content marketing, Asana) when a task needs them;
[`docs/guidelines/README.md`](docs/guidelines/README.md) says when.

## Claude Code specifics

- **Skills:** each `.claude/skills/<name>/SKILL.md` is a pointer to
  `.agents/skills/<name>/SKILL.md`, so Claude Code finds the repo's skills (`simplify` is the one
  alias, below). Edit the `.agents/skills/` copy. A new skill gets a pointer too, with the same
  `name` and `description`.
- **Self-review:** `/simplify` and `/self-review` both run this repo's
  [`self-review`](.agents/skills/self-review/SKILL.md) skill, with its four reviews as parallel
  subagents. `.claude/skills/simplify/` replaces Claude Code's built-in `/simplify`, a generic check
  that doesn't apply this repo's guidelines or the visual design review. Because a project
  `simplify` skill exists, Claude Code also runs it before each commit that isn't docs or tests
  (Claude Code v2.1.286 or later; a personal `~/.claude/skills/simplify` would win over it). Run
  it again before opening or updating a PR.
- **After every merge,** run `/wrapped` (the [`wrapped`](.agents/skills/wrapped/SKILL.md) skill).
- **Independent review:** run the [`pr-review`](.agents/skills/pr-review/SKILL.md) skill in a
  separate session or a subagent (for example `qa-reviewer`), never in the context that wrote
  the change.
- **Models and effort** (#522, the owner's choice to save Opus for where it counts):
  `.claude/settings.json` starts sessions on `opusplan` (Opus in plan mode, Sonnet once the plan is
  approved) at `medium` effort, and every agent in `.claude/agents/` runs on Sonnet at `medium`.
  Start the review on Opus at `high` effort (pass the model and effort when you start the
  reviewer) only when the PR touches sign-in or accounts, access rules, migrations, the deploy or
  server scripts, or other security code. Use the plain aliases (`opus`, `sonnet`), never a
  version, so the newest model is always used.
- **Agent team** ([operating model](docs/process/agent-operating-model.md), #685). Planned
  (#695): the chief of staff and the helpers will run on `opus`, and workers and standard
  reviewers stay on `sonnet` at `medium`. Review depth today is the #522 rule above and nothing
  wider. Never `fable` in unattended runs: it can bill to usage credits, and in `-p` runs without
  asking ([model config](https://code.claude.com/docs/en/model-config)). Gotchas from the
  subagent docs: `isolation: worktree` branches from the default branch, not the parent's `HEAD`;
  the `Agent(name, …)` limit on `tools` and `initialPrompt` apply only to an agent run as the main
  session (`claude --agent`) ([subagents](https://code.claude.com/docs/en/sub-agents)). A reviewer
  is a new, non-forked subagent, so it starts with no memory of the change.
- **Unattended runs** (#694): the owner's computer runs Windows 11, where the built-in sandbox
  runs commands unsandboxed; it needs WSL2 ([sandboxing](https://code.claude.com/docs/en/sandboxing)).
  So a headless run uses `--permission-mode dontAsk` with an exact `--allowedTools` list (the
  documented pattern for CI), never
  `--dangerously-skip-permissions`, which is for containers and VMs only
  ([permission modes](https://code.claude.com/docs/en/permission-modes)). A WSL2 sandbox is an
  option the owner decides in #697. Keep `ANTHROPIC_API_KEY` out of the environment: in `-p` runs
  the key is always used when present, which switches usage from the subscription to API billing
  ([authentication](https://code.claude.com/docs/en/authentication)). It was not set on the
  owner's computer on 2026-11-05 (user, machine and session scope).
- **Waiting for checks:** poll `gh pr checks <number>` in the background (`run_in_background`),
  about once a minute and for at most 15 minutes. Don't push while waiting. If the checks still
  haven't finished after 15 minutes, tell the user.
- **Subagents:** `.claude/agents/` registers each [role guide](docs/roles/README.md) as a subagent
  Claude Code can delegate to. Those files only hold Claude Code settings; edit the guide.
- **Hooks** (#446, in `.claude/settings.json`, scripts and tests in `.claude/hooks/`): after each
  Edit or Write, the file is formatted with Prettier and checked with ESLint in the checkout or
  worktree that holds it, and an error comes back to fix at once. Before each Bash command, the
  commands `AGENTS.md` forbids (`--admin`, `bypass_rules: true`, a push to `main`) are refused, and
  so is a commit whose `src/payload-types.ts` change is only `next dev` reformatting it. CI stays
  the real gate. Hooks run in local and cloud sessions alike.
- **Security plugin:** `.claude/settings.json` turns on Anthropic's `security-guidance` plugin,
  which reviews Claude's changes for security mistakes as it works. Local sessions install it once
  with `claude plugin install security-guidance@claude-plugins-official --scope project` (it needs
  Python 3.8+). Cloud sessions don't load plugins a repository turns on, so there CodeQL and the
  reviews cover it.
- **Browser and dev server:** `.claude/settings.json` allows the Playwright MCP tools used for
  screenshots, and `.claude/launch.json` starts `npm run dev`.
