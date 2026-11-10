---
name: change-workflow
description: Mandatory procedure for any code, config, or docs change to this repo — create a labeled GitHub issue, work on a branch, open a PR from the template (on a native stack when it depends on another open PR), get it independently reviewed, wait for all checks to go green, then merge it yourself once it's green and reviewed (which deploys). Use before starting any change.
---

# Change workflow

The rules are in [`AGENTS.md`](../../../AGENTS.md). This file is the step-by-step procedure.
Commands use the GitHub CLI (`gh`). Without it, do the same steps in the GitHub web UI.

## 1. Issue

1. Search first, so you don't open a duplicate: `gh issue list --search "<keywords>"`. Where
   GraphQL is blocked (some cloud sessions), use the REST search in
   [`project-tracking`](../project-tracking/SKILL.md) §3.
2. If there's no issue, create one from an issue form (web UI: **New issue** → pick a form).
   The CLI has no form support, so give it the same sections and labels by hand:

   ```bash
   gh issue create --title "<short problem statement>" \
     --label bug --label cms --label "priority: medium" \
     --body-file issue.md
   ```

   `issue.md` needs these sections: `### Problem`, `### Proposed fix`,
   `### Acceptance criteria`, `### Area`, `### Priority`. The REST form, and how to give the
   issue its epic, milestone and blockers, are in [`project-tracking`](../project-tracking/SKILL.md)
   §3.

3. Labels: exactly one type, at least one area, and one priority. Allowed values are in
   `.github/label-policy.json`.

## 2. Branch

```bash
git checkout main && git pull origin main
git checkout -b agent/<role-tag>/<issue-number>-<short-description>
```

If the change depends on another open PR, branch from that PR's branch instead of `main`, and
follow [`stacked-prs`](../stacked-prs/SKILL.md) from here on.

Role tags: `A-Content`, `B-Research`, `C-Builder`, `D-Community`, `E-Ops`, `F-RD`.
Humans can use `<name>/<issue-number>-<short-description>`.

Commits:

- Imperative mood ("Add email adapter"), one logical change per commit.
- Reference the issue in the body (`Refs #123`).
- AI-written commits end with a `Co-Authored-By:` line naming the model.
- Never commit secrets.

## 3. Check locally before opening the PR

```bash
npx tsc --noEmit                    # zero errors
npx eslint . --max-warnings=10
npx prettier --check .              # fix with: npx prettier --write <files>
npm run build                       # when code or dependencies changed
npm run docs:check                  # the generated reference matches the code (content types; routes and components once #718 lands)
```

Then review your own diff with [`self-review`](../self-review/SKILL.md) and fix what it finds.
This is a gate, not a suggestion ([guard rails](../../../docs/guidelines/guard-rails.md), rule 6):
don't open the PR until it has run on the final diff, and run it again after any later push. Write
the result in the PR's **Self-review** section. For
UI changes that includes the [`visual-design-review`](../visual-design-review/SKILL.md): every
affected page at six widths, in light and dark themes.

## 4. Pull request

```bash
git push -u origin <branch>
gh pr create --base main --title "<type>: <summary>" --body-file pr.md
```

**Depends on another open PR?** Then `--base` is that PR's branch, and the PR goes on a native
GitHub stack with it, so GitHub enforces the merge order: [`stacked-prs`](../stacked-prs/SKILL.md),
steps 2 and 3. Never hand over dependent PRs with the merge order written in prose instead.

`pr.md` follows `.github/pull_request_template.md`. Fill in every section; the `PR Policy`
check fails otherwise:

- `Closes #<issue>` — links the issue and closes it on merge. Use `Part of #<issue>`
  when more PRs will follow; the last PR uses `Closes`.
- **What changed**, **Why**, **How**, **How to test** (numbered steps someone else can
  follow), **Risk & rollback**, **Self-review** (one line each for reuse, quality, efficiency,
  guidelines and visual), **Knowledge** (`Behavior change: yes` and which note, page or doc now says so,
  or `Behavior change: none` and why in 20+ characters; what counts:
  [0019 §6](../../../docs/architecture/decisions/0019-knowledge-layer.md). A reason that is
  hidden markup or a stock phrase is a Blocker in the review)

Open it as a draft (`--draft`) while work is incomplete.

## 5. Review and checks

1. **Get an independent review.** Start a separate reviewer (a different agent session or a
   human) on [`pr-review`](../pr-review/SKILL.md). The author never reviews their own PR.
2. **Wait for CI without pushing.** Every push restarts the checks. Check roughly once a minute:

   ```bash
   gh pr checks <number> --watch
   gh pr view <number> --comments
   ```

   If the checks haven't finished after 15 minutes, stop and alert the owner.

3. **Act on the results:**
   - Check failed → fix, push, then wait again.
   - Review comments → fix or explain. Reply on each thread saying what you did, then
     resolve it. Never leave a conversation unresolved.
4. **Ready:** every required check passes on the current head, and a review says **Ready to merge**
   for that head (its `commit_id`) or for an earlier head that still counts
   ([`AGENTS.md`](../../../AGENTS.md) step 5). Every finding is addressed and every conversation
   resolved. To check that the PR's own diff is unchanged since the review, run
   `git range-diff <old base>..<reviewed head> <new base>..<current head>`; it should show only `=`
   lines. Unless the PR waits for the owner (an issue or PR labeled `needs owner`, or a policy
   change he didn't ask for, `AGENTS.md` step 3), note the head SHA and go to step 6. If it waits
   for him, label the PR `needs owner`, ask him one plain question, and stop
   ([waits for owner](../../../docs/process/project-management.md#waits-for-owner)).
   Also re-read the description's `End-to-end exemption:` line: if it is not `none`, it must be the
   one the review checked, because editing a description moves neither the head nor the checks.
5. **A PR below yours changed** (stacked PRs): rebase yours onto it and push, as in
   [`stacked-prs`](../stacked-prs/SKILL.md) step 4.

## 6. Merge and deploy

Merge with GitHub's asynchronous merge API, which is the only one that merges stacked PRs. It
keeps every rule enforced (`bypass_rules=false`). Pass the head SHA you noted in step 5.4, so
GitHub refuses if anything was pushed after the checks and the review:

```bash
H='X-GitHub-Api-Version: 2026-03-10'
sha=<head SHA noted in step 5.4>
gh api -X PUT repos/{owner}/{repo}/pulls/<number>/merge-async -H "$H" \
  -f merge_method=squash -f merge_action=direct_merge -F bypass_rules=false -f sha="$sha"
# 202: the answer has details.uuid. Poll until status is merged or failed:
gh api repos/{owner}/{repo}/pulls/<number>/merge-async/<uuid> -H "$H"
```

A `409` means a merge of this PR is already running: poll it instead of starting another. A
`200` means it was already merged.

- Never merge with `--admin`, `bypass_rules=true` or any other bypass. If GitHub refuses, read its
  message and fix the cause. If the head moved since step 5.4, go back to step 5.4: the new head
  needs green checks and a review that counts before you merge it.
- **A stack merges one layer at a time, from the bottom.** Merge the lowest open layer. GitHub
  then retargets the next layer to `main` and rebases it. Wait for that layer's checks on its new
  head, and, if the previous merge started a deploy, for it to succeed, before merging it.
- The merge's CI run deploys it, in its `Deploy / …` jobs, once the required checks pass
  (docs-only changes don't deploy; [`wrapped`](../wrapped/SKILL.md) step 2 says where to look).
  Then run
  [`wrapped`](../wrapped/SKILL.md): verify the merge, read the deploy's annotations, check the
  site (`https://sprechereast.com`) and the behavior that changed, and report.
- A failed deploy is fixed or reverted through a new PR, never on the server.
- A redeploy by hand is allowed within the limits in [`wrapped`](../wrapped/SKILL.md) step 2.
- The issue closes automatically. `issue-fix-summary.yml` comments on it with how it was fixed.

## Server or dashboard changes (`infra`)

For `.env.local`, Caddy, PM2, DNS, Mailgun, Porkbun, or Hostinger changes:

1. Open an issue labeled `infra` with the planned change, the reason, and the rollback.
2. Make the change. Back up any file first (`cp file file.bak-YYYYMMDD`).
3. Comment on the issue with what you changed. Never include secret values.

Code is never edited on the server. Code changes always go through steps 1–6.
