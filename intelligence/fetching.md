# Fetching: how the daily runner reads sources

The daily runner's rules for reading a source: direct first, Playwright only as a fallback, what
each answer means, and the hard nos. Part of the [intelligence README](README.md); the scheduled
scout follows [its own rules](scheduled-run.md), and the hard nos here apply to it too.

**Direct first.** Every source is read with a plain GET (or its feed or API client): content-type
detection, ETag and Last-Modified caching, and a deterministic parser for RSS, Atom, iCalendar,
JSON or HTML. `fetchStrategy` in `sources.yaml` is `direct` unless a source says
`direct-then-playwright`; today only Madison Parks events and the District 16 blog do (both are read directly: no fallback is built).

**Playwright only as a fallback**, for a `direct-then-playwright` source, when the direct answer
trips one of these triggers:

- a 200 with an empty body;
- a JavaScript shell: no text where items should be;
- a parse that finds no items, or fails its checks.

Every other answer is handled without a browser:

- **304:** `not-modified`; the source's run ends.
- **3xx:** followed directly (at most 3 hops, same rules at each), unless it leads to a gate.
- **5xx or 429:** retried once, honoring Retry-After; then an `error`.
- **401, 403, 451, or a login, paywall, CAPTCHA or bot gateway:** a gate; the source stops as
  `blocked`.
- **Any other 4xx (404, 410, ...):** an `error`, with no retry.

The fallback is one headless, logged-out page load of the same URL, at the same daily cadence.

**Logged every run.** Each source entry in the run log (`schemas/agent-run.schema.json`) records
`fetchStrategy`: the last strategy tried (`direct`, or `playwright` after a fallback), or `none`
when the source wasn't polled. The digest shows how often the fallback runs.

**Hard nos.** No logins, CAPTCHAs or paywalls (madison.com's redirect to `tollbit.madison.com`),
no path robots.txt disallows (Dane County's press subscription page), no social networks, and no
source the daily runner polls that isn't `valid` or `pending` in `sources.yaml` (the hand-run
scout may read other public pages, trusting them by tier). The check refuses
`direct-then-playwright` on any source without an `allowed` robots.txt result, on a source that
isn't HTML, or on one that is `restricted` or `invalid`. Agents summarize facts and never
republish articles. Reading a page and trusting it are
separate: see [Trust](sources.md#trust-reach-is-not-trust).

**Where Playwright runs.** In the agent runtime's scout step only. Never in the website, its
build or its CI: CI checks the files in this folder, including the direct path's rules and the
eval routing, and makes no network or model calls.

**Legal note**, checked against sources on #352. Public pages, read logged out with no gate, are
the least risky shape; the remaining risks are contract (terms accepted by logging in, which we
never do) and copyright (we summarize facts and link, never republish). _Ziff Davis v. OpenAI_
(S.D.N.Y., December 2025) held that robots.txt doesn't "control access" under the DMCA, and the
Ninth Circuit's Perplexity/Comet CFAA decision was reported in August 2026. Neither changes our
rule: we still honor robots.txt by choice. This is the project's reasoning, not legal advice.
