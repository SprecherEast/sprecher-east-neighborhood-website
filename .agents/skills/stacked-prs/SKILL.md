---
name: stacked-prs
description: Put pull requests that depend on each other on a native GitHub stack, so GitHub enforces the order they merge in — build the branches, create or extend the stack, keep it current when a lower PR changes, and merge it one layer at a time. Use whenever a change depends on another open PR, when adding a PR on top of an existing stack, or when a PR in a stack has to change.
---

# Stacked pull requests

[`AGENTS.md`](../../../AGENTS.md) requires it: **when a PR depends on another open PR, both go on a
native GitHub stack.** Writing the merge order in a PR description or a message ("merge #12
first, then #13") is never enough, because nothing stops someone from merging out of order. If
you find dependent PRs that aren't stacked, stack them.

A stack is an ordered chain of PRs in one repository. The bottom PR targets `main`; each PR above
targets the branch of the PR below it, so each PR shows only its own changes. GitHub then
enforces the order:

- PRs merge from the bottom up. Merging a PR also merges every PR below it, in order, so nothing
  can land without what it depends on. The PRs above stay open, are retargeted and rebased
  automatically.
- Branch rules and required checks apply to every PR in the stack as if it targeted `main`, so
  every layer must be green on its own.
- A stack is a single line: each PR sits on exactly one PR below it.

GitHub's documentation: [About stacked PRs](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs),
[how-tos](https://docs.github.com/en/pull-requests/how-tos/stacked-pull-requests),
[REST API](https://docs.github.com/en/rest/pulls/stacks).

## When to stack

- **Stack** when a PR needs code, configuration or a migration from another open PR, or when two
  PRs change the same lines and must land in a set order.
- **Don't stack** independent changes. Each gets its own PR on `main`, so neither waits for the
  other.
- **Work that needs several PRs** is split into sub-issues first, one per PR, and each PR says
  `Closes #<its sub-issue>` ([one issue, one pull request](../../../AGENTS.md#one-issue-one-pull-request)).
  Sub-issues that must land in order get stacked PRs, in that order; independent ones each go
  on `main`.
- **Upper layers may not link yet.** GitHub reads closing keywords only on a PR that targets the
  default branch ([linking a PR to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)).
  A layer above the bottom shows on its issue's timeline as a mention, but may not count as a
  linked PR, so its card may not move to In review. Once the layer below merges and it targets
  `main`, check that its issue lists it as linked, and say so on the issue if it doesn't.

## 1. Build the branches

Each branch starts from the branch below it. The bottom one starts from `main`:

```bash
git fetch origin
git switch -c agent/<role-tag>/<issue>-<first> origin/main     # layer 1
# …commit…
git switch -c agent/<role-tag>/<issue>-<second>                 # layer 2, from layer 1
```

Open each PR with its base set to the branch below (`main` for the bottom one):

```bash
gh pr create --base agent/<role-tag>/<issue>-<first> --title "<type>: <summary>" --body-file pr.md
```

To stack PRs that are already open, first set each one's base to the branch below it, from the
bottom up:

```bash
gh api -X PATCH repos/{owner}/{repo}/pulls/<number> -f base=<branch below>
```

## 2. Create or extend the stack

Any of these creates the same native stack: the GitHub website, the `gh stack` extension
(`gh extension install github/gh-stack`, then `gh stack --help`), or the REST API, which works
anywhere `gh api` does:

```bash
H='X-GitHub-Api-Version: 2026-03-10'
# Create: PR numbers from the bottom of the stack to the top.
gh api -X POST repos/{owner}/{repo}/stacks -H "$H" \
  -F 'pull_requests[]=101' -F 'pull_requests[]=102' -F 'pull_requests[]=103'
# Add on top of an existing stack: only the new PRs, from the current top upward.
gh api -X POST repos/{owner}/{repo}/stacks/<stack>/add -H "$H" -F 'pull_requests[]=104'
# Find the stack a PR is in, or read one.
gh api "repos/{owner}/{repo}/stacks?pull_request=<number>" -H "$H"
gh api repos/{owner}/{repo}/stacks/<stack> -H "$H"
```

(`-F` sends the numbers as integers, and `name[]=value` builds the list, so no JSON quoting is
needed in any shell.)

GitHub refuses a stack unless each PR's base is the head branch of the PR before it (the first
added PR sits on the current top). A `409` means someone else is changing the stack: wait and
retry.

## 3. Say so in each PR description

Put this line at the top of every PR body in the stack, so a reader sees the order before the
diff (GitHub also shows the stack in the PR's merge box):

```markdown
> **Layer <n> of native GitHub stack #<stack>.** It sits on #<PR below> (`<branch below>`).
> Layers merge one at a time from the bottom; GitHub enforces the order.
```

The bottom PR says it sits on `main`. Don't list the whole stack or its size in the line: GitHub
shows that, and the line stays true when the stack grows.

## 4. Keep the stack current

When a PR in the stack changes (a review fix, say), every PR above it must be rebased onto it,
from the bottom up. Fix a finding in the layer it belongs to, never in a higher one.

1. Before changing layer _k_, note its current head: `old=$(git rev-parse <branch k>)`.
2. Commit the fix on layer _k_.
3. For each layer above, in order: switch to it, note its head, then
   `git rebase --onto <branch below> <old head of the branch below>`. Resolve conflicts the same
   way in each layer. For a `package-lock.json` conflict, take either side and regenerate it with
   `npm install --package-lock-only --legacy-peer-deps --ignore-scripts`.
4. Run the checks (`npx tsc --noEmit`, `npm test`, ESLint, Prettier) on the layer you changed and
   on the top layer. A lower layer can fail on its own while the top passes, so after the push
   wait for CI on every layer, not just the top one.
5. Push every changed branch in one atomic push, with one lease per branch on the head you noted,
   so the stack is never half-updated and nobody else's push is lost:

   ```bash
   git push --atomic origin \
     --force-with-lease=<branch k>:<old head k> --force-with-lease=<branch k+1>:<old head k+1> … \
     <branch k> <branch k+1> …
   ```

6. Ask for a new review of every layer above _k_, even when its own diff didn't change: the code
   under it did ([`AGENTS.md`](../../../AGENTS.md) step 5). It can be short, checking the layer
   against what changed below.

`gh stack rebase --upstack` (from layer _k_) does step 3 for the layers above it, and
`gh stack push` pushes them, but that push is **not atomic**: some branches can update while
another is rejected. Use the `git push --atomic` above when that matters. The PR page on GitHub
can also run the cascading rebase on the server when there are no conflicts.

After part of a stack merges, GitHub rebases the PRs left above it. Before working on
one of them again, reset your local copy to GitHub's: `git fetch origin` then
`git switch -C <branch> origin/<branch>` (only when you have no unpushed work on it).

## 5. Review and merge

- Each layer gets its own independent review ([`pr-review`](../pr-review/SKILL.md)) and must pass
  every check on its own.
- Merge one layer at a time, from the bottom, with the asynchronous merge API and every rule
  enforced ([`change-workflow`](../change-workflow/SKILL.md), step 6). After each merge, GitHub
  retargets the next layer to `main` and rebases it. Wait for its checks on the new head, and for
  the previous deploy if that merge started one, before merging it. Merging a higher PR would merge
  everything below it in one go, which skips those checks between layers.
- To restructure a stack (reorder, drop or insert a layer), use `gh stack modify`; it keeps the
  stack. Without the extension, dissolve it with
  `gh api -X POST repos/{owner}/{repo}/stacks/<stack>/unstack -H "$H"`, which removes the
  unmerged PRs (a PR queued for merge stays; the answer is `200` with what's left, or `204` once
  the stack is gone), then fix the bases and create it again. Don't retarget a PR inside a stack
  by hand.

## Notes

- Cross-fork stacks aren't supported: all branches must be in this repository.
- Some sandboxes block GitHub's GraphQL API, which several `gh` commands use. The REST forms above
  (`gh api repos/…`) work everywhere.
