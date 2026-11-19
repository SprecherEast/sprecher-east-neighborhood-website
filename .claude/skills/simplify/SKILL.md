---
name: simplify
description: This repo's self-review under Claude Code's /simplify name — review and clean up your own change (reuse of existing helpers, code quality, efficiency, the repo's guidelines, whether the notes and docs still describe the behavior, and a visual design review for UI changes), then fix what it finds. Use before committing a code change and before opening or updating a pull request.
---

# simplify (Claude Code alias of self-review)

Read [`.agents/skills/self-review/SKILL.md`](../../../.agents/skills/self-review/SKILL.md) now and
follow it exactly.

This file only makes Claude Code's `/simplify` run this repo's self-review instead of its generic
built-in check. Because a project skill named `simplify` exists, Claude Code also runs it before
each commit that isn't docs or tests. Don't add instructions here; edit the `self-review` skill.
