# Start a session

How a session begins in each AI tool. The chief of staff runs in Claude Code, on a computer, on
the web or on a phone: only Claude Code loads its agent file, holds it to its limits and lets it
start workers. Any other tool takes one groomed issue and works on it. The rules stay in
[`AGENTS.md`](../../AGENTS.md); this page only says how each tool finds them.

## Tools that read the repository

| Tool        | What loads by itself                                                                    | Starts as                                         |
| ----------- | --------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Claude Code | `CLAUDE.md`, `.claude/`; `.claude/settings.json` names the chief of staff as default    | The chief of staff agent, with a worker per issue |
| Codex       | `AGENTS.md` and `.agents/skills/`                                                       | A worker on the issue named in the first message  |
| Gemini CLI  | `GEMINI.md`, which imports `AGENTS.md`                                                  | A worker on the issue named in the first message  |
| Grok Build  | `AGENTS.md` and `CLAUDE.md` (per xAI's own description; check with its inspect command) | A worker on the issue named in the first message  |

A session in another tool that is given no issue asks which one to take; it does not groom,
dispatch or speak for the chief of staff. It follows the same rules as any worker, and the ruleset
and the review stay the real gate.

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

## Chat apps (ChatGPT, Gemini, Grok on the web)

A chat app with a connected repository does not load these files by itself, and often cannot
write to GitHub, so nothing starts there and the chief of staff does not run there. To have one
read the plan or work on an issue, paste this as the first message:

> Read AGENTS.md in this repository. You are working on issue <number> only.

## Check it works on the organization's repository

A cloud session writes to GitHub through the Claude GitHub app, which probably has to be installed
on the `SprecherEast` organization and allowed on this repository (inferred from a refusal, not
confirmed). Without it, a write (issue, comment, label) fails with "Resource not accessible by
integration". To check, ask the session to add a comment to a throwaway issue. The repository is
`SprecherEast/sprecher-east-neighborhood-website`; the old personal address redirects to it.
Sessions on the owner's computer use his signed-in `gh` instead and are not affected.

## What the chief of staff can and cannot do today

It reports what keeps failing, lists the owner's open questions, grooms (routine changes applied,
the rest proposed), checks overlap and writes briefs. A worker does each issue. It never touches the board: it sets the `ready` label, Priority
and Effort on the issue and assigns it, from any session that can write issues, and the planner app
moves the card. It cannot read a card or change a sprint from a cloud session. The refusal table in
the [manual test](chief-of-staff-manual-test.md) has not been run yet.
