# Scheduled tasks outside the repository

Some tasks run on a schedule in the owner's cloud account, not in this repository, so no file here
defines them. This page lists them. What runs inside the application and in GitHub is generated,
in [`docs/reference/jobs.md`](../reference/jobs.md).

**This page is written by hand and updated by hand whenever one of these tasks changes.** The
facts below were read from the owner's account on 2026-11-24. It holds no task identifiers, prompt
text, secrets or personal details: the repository is public.

## Weekday neighborhood scout

- **Runs:** on weekdays, in the early evening, Central time.
- **Works from:** the repository's `main` branch and its instructions in
  [`intelligence/`](../../intelligence/README.md). The schedule's own prompt only points at the
  repository; the run rules are kept there, not here.
- **May do:** read the sources the instructions name and write a report. It is read-only: it does
  not call the CMS, open issues or pull requests, or publish anything.
- **Ends with:** a report for the owner, who reviews it before any site update is made.
- **Carries:** one temporary watch item, set by the owner.
