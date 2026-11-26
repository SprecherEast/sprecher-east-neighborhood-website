# Scheduled tasks outside the repository

Some tasks run on a schedule in the owner's cloud account, not in this repository, so no file here
defines them. This page lists them. What runs inside the application and in GitHub is generated,
in [`docs/reference/jobs.md`](../reference/jobs.md).

**This page is written by hand and updated by hand whenever one of these tasks changes.** The
facts below were read from the owner's account on 2026-11-24. It holds no task identifiers, prompt
text, secrets or personal details: the repository is public.

## Weekday neighborhood scout

- **Runs:** on weekdays, in the early evening, Central time.
- **Instructions:** the run rules are kept in the repository, in
  [`intelligence/scheduled-run.md`](../../intelligence/scheduled-run.md) on `main`: what to set up
  and read first, how to run the stages by hand, fetching, the read-only rule, duplicates, watch
  items, the report layout and when to notify the owner. The schedule's prompt is to shrink to a
  pointer at that file ([#1517](https://github.com/SprecherEast/sprecher-east-neighborhood-website/issues/1517)
  is still open); where the two differ, the file wins, except that the read-only rule always holds.
  The prompt also adds one temporary watch item set by the owner. That item is stored in the
  schedule, not in the repository.
- **What it reads:** a fresh read-only checkout of `main`: the pipeline's settings and
  instructions (the README, `pipeline.yaml`, coverage, area, sources, images and the stage
  prompts). If `pipeline.yaml` has the pipeline disabled, it stops and reports that. It replaces
  the submit stage with a report.
- **May not:** write anything outside its own report. It makes no CMS call, opens no issue or pull
  request and publishes nothing.
- **Ends with:** a report for the owner, who reviews it before any site update is made, in the
  layout the file sets. A push notification goes out only when the run found something to know
  now or could not read its sources.

## Not covered here

- The server's own cron job (the daily data backup) is installed by `ops/install-cron.sh`, so it is
  in the repository and on the generated jobs page.
- The pipeline settings in `intelligence/pipeline.yaml` state a daily schedule, shown on the jobs
  page. What starts a run from it, and where, is not recorded here, because it has not been
  confirmed for this page.
