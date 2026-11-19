# Source

Vendored unchanged from Vercel's official agent skills (#424):

- Repository: https://github.com/vercel-labs/agent-skills
- Path: `skills/composition-patterns/` (`SKILL.md` and `rules/`)
- Commit: `063bee94c3f4df8453406c830b0a7df0f2860278`
- Licence: MIT (Vercel)

Left out: the skill's compiled `AGENTS.md` (the same rules in one long file). Codex would read a
nested `AGENTS.md` as instructions for this folder, so read the rule files in `rules/` instead.

**This repo's own rules come first.** Where a rule here differs from
[`AGENTS.md`](../../../AGENTS.md), [`docs/architecture/`](../../../docs/architecture/README.md) or
[`docs/guidelines/`](../../../docs/guidelines/README.md), the repo wins. A rule that needs a
package we don't use yet (for example SWR or an LRU cache) goes through the
[package rules](../../../docs/guidelines/security.md#before-adding-any-new-package) first.

The code examples are upstream's, kept as they are: the "Documentation Is Code" rule doesn't
apply to them. Don't edit vendored files; record a difference here instead.

To update: copy `SKILL.md` and `rules/` from the latest upstream commit, update the commit
above, and note what changed in the PR.
