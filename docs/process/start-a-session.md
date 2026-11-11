# Start a session

How a session begins as the chief of staff, whichever AI tool you use. The rules stay in
[`AGENTS.md`](../../AGENTS.md); this page only says how each tool finds them.

## Tools that read the repository

| Tool        | What loads by itself                                                                    | Starts as                                           |
| ----------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Claude Code | `CLAUDE.md`, `.claude/`; `.claude/settings.json` names the chief of staff as default    | The chief of staff agent, with a worker per issue   |
| Codex       | `AGENTS.md` and `.agents/skills/`                                                       | The chief of staff, through the line in `AGENTS.md` |
| Gemini CLI  | `GEMINI.md`, which imports `AGENTS.md`                                                  | The chief of staff, through the line in `AGENTS.md` |
| Grok Build  | `AGENTS.md` and `CLAUDE.md` (per xAI's own description; check with its inspect command) | The chief of staff, through the line in `AGENTS.md` |

Only Claude Code enforces the chief of staff's limits (no editing, pushing or merging) in its
agent file. In the other tools they are instructions, so the ruleset and the review stay the real gate.

A session that should only do one task says so in its first message and skips the routine. In
Claude Code the default session cannot edit files: for a task session, start `claude --agent worker`
(a headless `-p` run also starts as the chief of staff unless given `--agent`). The Grok Build and
Gemini CLI behavior comes from their own descriptions of what they load and is not yet tried here.

## A session attached to the repository mid-conversation

A cloud session that gets the repository partway through a chat has not loaded the instructions
yet, so the chief of staff agent is not registered until they reload. Then:

1. Read `AGENTS.md`, then load the
   [chief of staff skill](../../.agents/skills/chief-of-staff/SKILL.md) by hand and follow its
   start-of-session routine.
2. Say what is unreachable from that session: the project board and the organization project API.
   No card can be read there, and a card moves only through the issue (assigning it, or the
   `ready` label), so say so on the issue or in the report instead of guessing at board state.
3. Before filing an issue or opening a pull request, read the [filing checklist](filing-checklist.md),
   in a task session too.

An instruction helps only if the tool reads it; the checks stay the safety net.

## Chat apps (ChatGPT, Claude, Gemini, Grok on the web)

A chat app with a connected repository does not load these files by itself, so nothing starts
automatically there. Paste this as the first message:

> Read AGENTS.md in this repository, then follow the chief of staff skill at
> .agents/skills/chief-of-staff/SKILL.md. Start with its start-of-session routine.

A chat app often cannot write to GitHub. Then the chief of staff reads and proposes, and a session
on a tool above does the writing.

## Check it works on the organization's repository

A cloud session writes to GitHub through the Claude GitHub app, which probably has to be installed
on the `SprecherEast` organization and allowed on this repository (inferred from a refusal, not
confirmed). Without it, a write (issue, comment, label) fails with "Resource not accessible by
integration". To check, ask the session to add a comment to a throwaway issue. The repository is
`SprecherEast/sprecher-east-neighborhood-website`; the old personal address redirects to it.
Sessions on the owner's computer use his signed-in `gh` instead and are not affected.

## What the chief of staff can and cannot do today

It reads the plan, lists the owner's open questions, grooms in dry run, checks overlap and writes
briefs. A worker does each issue. It never touches the board: it sets the `ready` label, Priority
and Effort on the issue and assigns it, from any session that can write issues, and the planner app
moves the card. It cannot read a card or change a sprint from a cloud session. The refusal table in
the [manual test](chief-of-staff-manual-test.md) has not been run yet.
