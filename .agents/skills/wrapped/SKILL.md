---
name: wrapped
description: Post-merge wrap-up, run right after you merge a PR or when someone says the PRs are merged (or "wrapped") — verify each merge, check the deploy and the live site, report server results on the linked issues, sync your local main, and report. Use after every merge; never assume a merge happened.
---

# Wrapped: after a merge

Run this right after you merge a PR, or when someone says the work is merged ("all PRs are
merged", "wrapped", or similar). Verify everything; never assume a merge or a deploy happened.

## 1. Verify the merges

For each PR from the work at hand:

```bash
gh api repos/{owner}/{repo}/pulls/<number> -q '.merged_at, .merge_commit_sha'
```

An empty `merged_at` means it isn't merged: say so and stop there for that PR. For a stack, only
part of it may be merged; the PRs still open above are rebased by GitHub
([`stacked-prs`](../stacked-prs/SKILL.md), step 4).

## 2. Check the deploy and the site

A merge to `main` deploys from inside its **CI** run: once `Type-check & Build` passes, CI calls
`.github/workflows/deploy.yml`, whose jobs show as `Deploy / Preflight`, `Deploy / Build release`
and `Deploy / Deploy` (#245). There is no separate deploy run for a merge. Preflight decides
whether anything deploys: docs-only changes, and commits older than the live one, don't.

1. Find the CI run for the merge commit and wait for it:
   `gh run list --workflow ci.yml --commit <merge_commit_sha>`, then `gh run watch <id>`.
   Where the Actions API is blocked, ask for the deploy's check runs by name (a `main` commit
   collects many other check runs), for example
   `gh api "repos/{owner}/{repo}/commits/<merge_commit_sha>/check-runs?check_name=Deploy%20%2F%20Deploy"`.
   Each check run's `id` is the job id for the next step.
2. Read the annotations (the `::notice` / `::warning` / `::error` lines the scripts print):
   `gh api repos/{owner}/{repo}/check-runs/<job id>/annotations`.
   - `Deploy / Preflight`: the plan, for example "nothing is deployed" for docs only. When it
     says nothing deploys, `Build release` and `Deploy` are skipped, and that's the result.
   - `Deploy / Build release`: the release built, and its Node version.
   - `Deploy / Deploy`: the server's results ("release … is live", backups, Caddy) and the
     checks from the internet.
3. Open https://sprechereast.com and check the behavior the PRs changed.

### Starting the deploy by hand

An agent may start the `Deploy to VPS` workflow by hand, on `main`, when a redeploy is needed (the
owner's decision, #972). The limits:

- It never takes the place of a required check, a review, or a fix through a pull request, and it
  never bypasses a rule.
- First check that no deploy is running. A merge's deploy runs inside the **CI** run, so look at
  every run of `main` that is not finished, and wait for it:
  `gh api "repos/{owner}/{repo}/actions/runs?branch=main&status=in_progress"`, and again with
  `status=queued`. Both must list no run.
- Start it with the REST call below, then verify it as in this step: find the run, read the
  annotations, check the site.
- Say on the linked issue why it was started, and which run.
- A failed deploy gets a new issue and is fixed or reverted through a PR. Never fix it on the server.

```bash
gh api -X POST repos/{owner}/{repo}/actions/workflows/deploy.yml/dispatches -f ref=main
# 200: the answer names the new run (workflow_run_id, html_url). Watch it: gh run watch <id>
```

## 3. Close the loop on the issues

- The linked issues close themselves on merge, and `issue-fix-summary.yml` comments on each.
- For server changes (`infra` issues), comment what actually changed on the server, from the
  deploy annotations. Never paste secret values.
- An issue linked with `Part of #N` stays open until its last PR merges.

## 5. Sync and report

```bash
git fetch origin && git switch main && git pull --ff-only origin main
```

Then report briefly: what merged, what deployed, the deploy's result, anything still open or
failing, and anything waiting on the owner (`needs owner`).
