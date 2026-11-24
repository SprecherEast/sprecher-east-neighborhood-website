# Scheduled tasks outside the repository

Some tasks run on a schedule in the owner's cloud account, not in this repository, so no file here
defines them. This page lists them. What runs inside the application and in GitHub is generated,
in [`docs/reference/jobs.md`](../reference/jobs.md).

**This page is written by hand and updated by hand whenever one of these tasks changes.** The
facts below were read from the owner's account on 2026-11-24. It holds no task identifiers, prompt
text, secrets or personal details: the repository is public.

## Weekday neighborhood scout

- **Runs:** on weekdays, in the early evening, Central time.
- **Instructions:** the schedule's own prompt points at the repository (the `main` branch and its
  [`intelligence/`](../../intelligence/README.md) instructions) for how to work, so the run rules
  are kept there, not here. The prompt adds one temporary watch item of its own, set by the owner.
  That item is stored in the schedule, not in the repository.
- **What it reads:** the pipeline's instructions (the README, coverage, area, sources and the
  stage prompts). It replaces the submit stage with a report.
- **May not:** write anything outside its own report. It makes no CMS call, opens no issue or pull
  request and publishes nothing.
- **Ends with:** a report for the owner, who reviews it before any site update is made.

## Not covered here

- The server's own cron job (the daily data backup) is installed by `ops/install-cron.sh`, so it is
  in the repository and on the generated jobs page.
- The pipeline settings in `intelligence/pipeline.yaml` state a daily schedule, shown on the jobs
  page. What starts a run from it, and where, is not recorded here, because it has not been
  confirmed for this page.
