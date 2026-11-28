# Scheduled tasks outside the repository

Some tasks run on a schedule in the owner's cloud account, not in this repository, so no file here
defines them. This page lists them. What runs inside the application and in GitHub is generated,
in [`docs/reference/jobs.md`](../reference/jobs.md) (build it with `npm run docs:generate`).

**This page is written by hand and updated by hand whenever one of these tasks changes.** The
facts below were read from the owner's account on 2026-11-24, except the Instructions bullet,
which describes the schedule from the moment its prompt is repointed at the file (tracked on
[#1517](https://github.com/SprecherEast/sprecher-east-neighborhood-website/issues/1517)). It holds no task identifiers, prompt
text, secrets or personal details: the repository is public.

## Weekday neighborhood scout

- **Runs:** on weekdays, in the early evening, Central time.
- **Instructions:** the schedule's prompt only says to check out `main` and follow
  [`intelligence/scheduled-run.md`](../../intelligence/scheduled-run.md), plus one temporary watch
  item set by the owner, which is stored in the schedule, not in the repository. The file holds the
  run rules: what to set up and read first, how to run the stages by hand, fetching, the read-only
  rule, duplicates, watch items, the report layout and when to notify the owner. Where the prompt
  and the file differ, the file wins, except that the read-only rule always holds.
- **What it reads:** a fresh read-only checkout of `main`: the pipeline's settings and
  instructions (the README, `pipeline.yaml`, coverage, area, sources, images, the schemas and the
  stage prompts). If `pipeline.yaml` has the pipeline disabled, it stops, writes a report
  with only the run header saying so, and notifies the owner. It replaces the submit stage with a
  report. It judges duplicates from the live site and other public pages. It never calls the City's
  address locator, so it does not test addresses against the boundary and says so in the report.
- **May not:** write anything outside its own report, apart from the one push notification to the
  owner. It makes no CMS call and holds no key for the CMS or its MCP endpoint, opens no issue or
  pull request and publishes nothing.
- **Ends with:** a report for the owner, who reviews it before any site update is made, in the
  layout the file sets. A push notification goes out only when the run found something to know
  now, could not read its sources, or found the pipeline disabled.

## Not covered here

- The server's own cron job (the daily data backup) is installed by `ops/install-cron.sh`, so it is
  in the repository and on the generated jobs page.
- The pipeline settings in `intelligence/pipeline.yaml` state a daily schedule, shown on the jobs
  page. What starts a run from it, and where, is not recorded here, because it has not been
  confirmed for this page.
