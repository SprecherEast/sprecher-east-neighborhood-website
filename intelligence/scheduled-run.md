# Scheduled scout run

The rules for the scout that runs on a schedule in the owner's Claude account (#1356). The
schedule itself (time, model, connectors, network) lives there, because this repository cannot
set it; the schedule's prompt only says to check out `main` and follow this file. The daily
runner described in the [README](README.md#how-a-runtime-loads-it) is a different runtime and is
not covered here. Change this file only through a pull request.

## Read first

Before reading any source or drafting anything, read from `main`: the [README](README.md),
[`coverage.md`](coverage.md), [`area.yaml`](area.yaml), [`sources.md`](sources.md) (including
[trust](sources.md#trust-reach-is-not-trust)), the stage prompts in [`prompts/`](prompts/) and the
site's [brand voice](../docs/guidelines/brand-voice.md). Draft copy follows the brand voice from the first
draft, not in a second pass.

## Fetching

- Reach pages the ways that need no approval: found through search, linked from a page already
  read, or a registered source's own feed address in [`sources.yaml`](sources.yaml), read with a
  plain request. A registered feed is read directly, not only found through search.
- On any permission or approval error, do not retry and do not ask. Use another route and list the
  source as blocked in the report.
- The README's "Hard nos" apply: no logins, paywalls or CAPTCHAs, no path robots.txt disallows,
  no social networks.

## Read-only

The scout reads and reports. It never writes to the CMS, issues, pull requests or any other
service, and it publishes nothing. Its only output is the report. The owner reviews the report
before any site update is made.

## New sites

The scout may find and read sites beyond the registry. Reading is free; trusting is not
([trust tiers](sources.md#trust-reach-is-not-trust)). A site found this way is reported to the
owner as a suggestion, with its tier and what it could prove, before anything depends on it.

## Checking a fact the site already states

- Before calling a published fact wrong, open the official record for it. Without that record,
  the finding goes under "could not verify", not under "errors".
- When an issue already tracks the topic, read its confirmed facts first and treat them as known.
  Check only what is still open.

## Watch items

A watch item is a standing question the owner adds to the schedule for a while. Each one names its
tracking issue, says what is already settled there, states the one open question, and says how
often to check and where. The answer is one line. A run never puts settled facts back in doubt.
The item is removed from the schedule when it is resolved; it is not copied here.

The budget watch follows this shape: the run reads the budget tracking issue (#1374) first, takes
its confirmed facts as known, and asks only whether the City has posted an adopted budget book or
adopted spending by area. It checks once a week, on one page, and answers in one line.

## Report layout

One report, in this order, so the owner can review it quickly. Leave out a section that has
nothing to say, and don't add text to a section where the items already say it.

1. **New for the site:** items worth a suggestion, each with what it is, when and where, the source
   and its tier, and draft copy in the brand voice.
2. **Changes to what the site says:** a published fact that an official record contradicts, with
   the record.
3. **Could not verify:** claims with no primary record, and why.
4. **Blocked sources:** each source that could not be read, and the reason.
5. **Suggested sites:** sites found beyond the registry, with their tier.
6. **Watch items:** one line each.
