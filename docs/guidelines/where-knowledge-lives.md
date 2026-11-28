# Where knowledge lives

Durable knowledge lives in this repository and changes through the workflow in
[`change-workflow`](../../.agents/skills/change-workflow/SKILL.md), never in a tool's private
memory, a chat, or loose notes. Write it for any agent and human (no tool-specific commands or
model names), each file under 250 lines.

- A rule everyone follows on every change: [`AGENTS.md`](../../AGENTS.md).
- How a module or the content types work: [`docs/knowledge/index.md`](../knowledge/index.md), one
  line per note, each next to its code (`src/modules/<name>/README.md`), plus the generated
  `docs/reference/`. Read the note before changing a module. **A behavior change and the note that
  describes it change in the same PR** ([0019](../architecture/decisions/0019-knowledge-layer.md) §6).
- Why the site exists and what comes next: [`docs/product/`](../product/vision.md).
- How work is planned and tracked, and how the agent team works:
  [`docs/process/`](../process/project-management.md).
- A convention: a guideline in [`docs/guidelines/`](README.md). A procedure: a skill.
  What a role checks: its guide in [`docs/roles/`](../roles/README.md).
- A fact about the system: [`docs/project.md`](../project.md) (stack, hosting, gotchas),
  [`docs/architecture/`](../architecture/README.md) (where code goes, data model; read it before
  coding), `ops/README.md` (server scripts). The reason behind a decision: a record in
  `docs/architecture/decisions/`.

## Tool adapters

The other tools load `AGENTS.md` themselves (Gemini via a one-line `GEMINI.md`, [start a
session](../process/start-a-session.md)). Claude Code adds a thin adapter: `CLAUDE.md`, importing
`AGENTS.md`, and `.claude/`: a pointer to each skill, the subagents, and the rules that load a
reference when the work touches its files, generated from the load table in [`README.md`](README.md).
An adapter holds only what is specific to its tool. Never put a rule, procedure or fact only in an
adapter: the other tools wouldn't see it.
