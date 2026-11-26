# Neighborhood intelligence agents

This folder is everything an agent runtime needs to find useful, verified neighborhood
information and suggest it to the site's editors (#255, #337): the sources, the area, the prompts,
the data contracts and the test cases. It holds no code that runs on the site, no secrets and no
personal data. It changes only through pull requests, which CI checks.

The agents never publish. They create **suggested drafts**; an editor reads, fixes and publishes.

## What's here

| Path                                   | What it is                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`pipeline.yaml`](pipeline.yaml)       | The settings a runtime reads first: kill switch, schedule, budgets, stages                     |
| [`sources.yaml`](sources.yaml)         | Approved sources, each checked by hand ([summary](sources.md))                                 |
| [`coverage.md`](coverage.md)           | The Sprecher East area and the relevance policy                                                |
| [`area.yaml`](area.yaml)               | The words and boundary record used to spot the area: places, neighbors, highway rules          |
| [`boundary.json`](boundary.json)       | The City's boundary for the area, a dated copy (#1009); `run.mjs --refresh-boundary` renews it |
| [`safety.yaml`](safety.yaml)           | What counts as a safety item, which always waits for a person                                  |
| [`background.md`](background.md)       | The City's 1998 neighborhood plan, summarized with pages (index; topics in `background/`)      |
| [`images.md`](images.md)               | How to choose a story's or event's photo: real, free, on topic, level                          |
| [`scheduled-run.md`](scheduled-run.md) | The rules for the scout that runs on a schedule in Claude: fetching, read-only, report layout  |
| [`prompts/`](prompts/)                 | One prompt per stage, each naming its input and output schema                                  |
| [`schemas/`](schemas/)                 | JSON Schemas for every file and every stage's output                                           |
| [`evals/`](evals/)                     | Test cases per stage with the result a correct pipeline reaches                                |

## The pipeline

One run takes each new or changed item through five stages. Each stage reads the item and adds
its own section (`schemas/item.schema.json`); it never changes an earlier one.

1. **Scout** (code). Fetches the pilot sources, parses them, and builds a candidate with a stable
   `externalId` and a `contentHash`. Items already seen with the same hash stop here.
2. **Verify** (model, then code). Finds the real place, date and status from primary sources, sets
   the coverage tier, and lists every unknown. Runs the five checks in `coverage.md`, "Review
   passes": primary source, place, freshness, physical facts and stage of a project. Code then
   places the item by the City's boundary when its street address resolves, and records the
   method in `$.placement` (`boundary`, `word-match` or `unplaced`, #1009).
3. **Curate** (model). Accepts, rejects or sends to review, scores the item, and says who
   benefits and what they can do. Detects duplicates, updates and cancellations of known items.
   It is the second read of the verify result, and proposes any accepted item's organizer or
   publisher that isn't in `sources.yaml` as a `pending` source in its reasons (no code records
   it yet, #1008).
4. **Draft** (model). Writes the short suggestion, with only confirmed facts and a list of what's
   missing.
5. **Submit** (code). Sends accepted drafts as suggestions and everything an editor must check
   as review items, through #336's MCP tools, and writes the run log.

The pipeline reads an item twice: the verify checks, then curate's second read. Both are prompt
rules. The freshness re-check right before publishing is a step for the person or AI agent who
publishes by hand, not a pipeline stage. A safety item is never accepted: code holds it for a
person whatever the model answers (below, and `coverage.md`, "Review passes").

Deterministic steps come first: fetching, parsing and deduplication never use a model. The
model handles only relevance, location ambiguity and the write-up, at medium effort, escalating to
high only for conflicting or ambiguous evidence (`model` in `pipeline.yaml`).

## Fetching (#352)

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

## How a runtime loads it

[`runner/`](runner/README.md) runs it (#364): the code stages (scout and submit), the schema
checks, routing, budgets and the run log are code there, and only verify, curate and draft go to a
model, through one adapter. By default that's an OpenClaw agent on the owner's machine, on his
flat ChatGPT subscription; the agent has no tools and never sees the CMS key, which only the
runner holds. OpenClaw's own cron starts `node runner/run.mjs` daily. The OpenClaw configuration,
schedule and key stay outside this repo; any runtime that can run a command or answer a prompt can
run the same folder.

1. Check out this repository's `main` (read-only) at the start of each run, and record its commit
   as `repoCommit` in the run log, so every suggestion can be traced to the exact prompts that made it.
2. Read `pipeline.yaml`. If `enabled` is false, log a `disabled` run and stop.
3. Load the schemas in `schemas/`, `sources.yaml`, `coverage.md`, `safety.yaml`, `area.yaml` and the `boundary.json` it names (the area file is given to the
   model with `coverage.md`), and read the category tree
   with the MCP find tool (`categories`: slug, title, parent) into each item's `taxonomy`
   (`common.schema.json#/$defs/taxonomy`), so the draft stage picks only existing categories
   (#363). Add each item's `source` from `sources.yaml` (owner, reliability, scope), so verify
   can treat an official feed's own date, time and venue fields as the primary source.
4. For each stage in order, give the model the stage's prompt, `coverage.md`, and the item as
   JSON; validate its answer against the stage's `output` schema. When verify's `confidence` is below
   `escalation.verifyBelowConfidence` (0.6), run verify once more at high effort. An answer that doesn't validate
   is retried once, then the item goes to review with the error.
5. Before curate, look each candidate's `externalId` up with the MCP find tool (runtime code, not
   a model) and put the result in the item's `known` section: collection, id, hash and status,
   or null.
6. Feed URLs in `sources.yaml` can hold `{from}`, `{to}` and `{cursor}`; `prompts/scout.md` says
   what each becomes.

## Schedule and budgets

- **Daily pilot** at 06:40 America/Chicago (`schedule` in `pipeline.yaml`), reading the pilot
  sources of `sources.yaml` (valid, with a rank).
- **Look-ahead** (`lookAheadDays` in `pipeline.yaml`, #995): scout reads 60 days ahead by default
  (the owner's decision, 2026-11-23), and a source that publishes earlier sets its own
  `lookAheadDays`. Each run reads every source again, so an event found far ahead comes back as
  an update when its details change near its date. The schema refuses a default under 60.
- **Low-water mark** (`lowWater.upcomingEvents`, #995): at the end of each run, code counts the
  published, uncancelled upcoming events with the MCP find tool (exact up to the mark). Under the
  mark, the run log gets a "Low events" line in its errors (a note: it doesn't make the run
  `partial`) and the digest shows `upcoming` (`count`, `mark`, `low`). With no key, or when the
  count fails, the digest shows `count: null`, never zero. The CMS run log has no field of its
  own for it yet.
- **Budgets** (`budgets` in `pipeline.yaml`): at most $0.50 and 15 minutes per run, $15 per month,
  50 items per source, 40 items sent to a model and 10 drafts per run. The runtime stops when a
  limit is reached, logs the run as `stopped-budget`, and leaves the rest for the next run. The
  dollar limits apply to a runtime billed per call; on the owner's flat subscription a run costs
  nothing per call, so the runner logs `usd: 0` and the time and item limits are the ones that
  stop it.
- A run that can't reach a source logs the error for that source and carries on with the others.

## Output: suggestions and review items in the CMS

The submit stage talks to the site's CMS through the official Payload MCP plugin at
`https://sprechereast.com/api/mcp` (#336), with the agent user's own API key. The key is created
by an admin in the CMS and kept in the runtime's secret store, never here. The agent calls only
the find tool and two custom tools from #336; it can't create, update, delete or publish
documents directly.

- **`submitSuggestion`** (`schemas/suggestion.schema.json`) for accepted items: the collection
  (`events` or `posts`), title, `bodyMarkdown`, the card `summary`, one or two `categories`
  (slugs from the run's `taxonomy`), start, end, all-day, venue, address, audience, provenance and
  run ID. The server converts the Markdown with Payload's own converter, stores the summary as the
  card text, links the categories (an unknown slug is refused), gives the draft the first
  category's default image (or its parent's), forces an unpublished draft with
  `moderationStatus: suggested`, refuses a duplicate, and answers
  `{ id, status: created | duplicate }`.
- **`reportItem`** (`schemas/report.schema.json`) for everything an editor must look at without
  a new draft: `needs-review` items, `update` and `cancel` of a known document (by
  `targetCollection` and `targetId`; the document is never changed), and `rejected-invalid`
  submissions. Each carries a summary, evidence, flags and the source URL, and is stored on the
  run in `agent-runs`, visible in Admin.
- **Provenance:** `sourceName`, `sourceUrl`, `externalId`, `contentHash` and
  `moderationStatus` are defined once, in
  [`schemas/provenance.schema.json`](schemas/provenance.schema.json), with the hash recipe; the
  CMS fields (#123, #336) use the same names. To rename one, change that file and the prompts in
  the same PR, and the CMS in its own.
- **Run log:** each run creates one `agent-runs` entry at the start and updates it at the end
  (`schemas/agent-run.schema.json`): the repository commit it loaded, start and end, sources
  checked with their cursors, counts, errors and cost.

Routing by the curate decision (`routes` in `pipeline.yaml`): `accept` → `submitSuggestion`; `needs-review`, `update`, `cancel`
→ `reportItem`; `reject`, `duplicate` → counted only. A suggestion with missing facts or low
confidence also gets a `needs-review` report pointing at it.

Before routing, code applies `promotionGuard` (`pipeline.yaml`, #870): an `accept` becomes
`needs-review` when verify's confidence is below `escalation.verifyBelowConfidence` after the
rerun, or verify's flags include one of `promotionGuard.blockingFlags`, whatever the model
answered. The threshold and the flag list each have one definition, in `pipeline.yaml`.

The same gate (`runner/lib/gate.mjs`, #1007) holds a **safety item**. What makes one is written once,
as a principle, in [`safety.yaml`](safety.yaml), and the model stages (verify and curate) apply it by
what an item means, in any language and wording. The gate itself is three rules and reads no text
of any item:

1. An item from an always-held source (the `sources` list in `safety.yaml`) is held, whatever it
   says. The source facts must be present and match the candidate's source, and a listed
   `alsoReportedBy` holds it too. The registry's own wording (owner, scope) is never read.
2. An item is held when verify or curate answered `safety` with anything but a plain `false`:
   `true`, a word or a number, no answer, or an error. Within a run, once a stage has said safety, a
   rerun or retry can't take it back.
3. Only one function can send a suggestion, and it runs the gate first. `routes` can't send a held
   item to `submitSuggestion`. Submit runs the gate itself before it sends anything. `run.mjs`
   creates the real CMS client and hands it to `pipeline.mjs`, which keeps it inside one function
   that only runs submit; every other part of a run gets a client with no way to suggest
   (`withoutSuggestions`, `runner/lib/cms.mjs`).

One more rule keeps a safety item from being lost without a person (#993): the model stages have no
tools, so the runner reads the report page of each such item that reaches them
(`runner/lib/pageRead.mjs`: one request, no retry, no redirect, the source's own https origin,
robots.txt honored, at most 1 MiB, ten seconds) and puts its text, markup removed and cut to 8,000
characters, in the item verify is given as `reportPage`, untrusted like any source text. The gate
holds any `reject` or `duplicate` of an item from an always-held source for review unless that text went to verify,
whatever verify wrote. Whether it did is a fact the code knows, so an unread page can only end in
review, whatever curate decides. At most one page is fetched per such item, within the run's model budget.

The runner checks `pipeline.yaml` and `safety.yaml` against their schemas when it starts, and refuses
to run on a failure, an unknown source id, or an empty source list.

The limit, in plain words: an item from a source that is not on the list, which both model stages
misjudge, arrives as an ordinary unpublished draft without the safety flag. The editors' review is
the last check, and nothing is published without the owner's review either way. A new safety source
is added to the list when it is added to the registry.

Until #336 is live, a run writes the same calls and its run log as a digest for an editor instead.

## Turning it off

- **Pause:** set `enabled: false` in `pipeline.yaml` through a PR. The next run stops before
  fetching anything.
- **Stop at once:** an admin revokes the agent's API key in the CMS. Every call fails; nothing
  else on the site changes.
- **Undo suggestions:** suggested drafts are never public. An editor deletes or rejects them.

## Safety

- **Model stages are isolated.** Verify, curate and draft run with no MCP key, no CMS access, no
  file or shell access and no other tools. Only verify may fetch, and only with GET, from the
  source's own domain and official public domains (City of Madison, Dane County, Madison Public
  Library, MMSD, the State of Wisconsin). The MCP key is used only by the submit code, which
  takes no instructions from a model. So text injected into a page can't reach a secret or the CMS.
- Fetched pages, feeds and PDFs are untrusted data, never instructions. Every prompt says so and
  flags injection attempts (`prompt-injection`).
- Only `valid` sources in `sources.yaml` are polled. No social networks, logins or paid gateways.
- Unknown facts are flagged, never filled in.
- The runtime has no GitHub write access and no server access. A change to prompts or sources is a
  pull request, reviewed and checked like any other.

## Changing it

Edit the files, then run `node scripts/check-intelligence.mjs`. It validates `pipeline.yaml`,
`sources.yaml`, `safety.yaml` (each source it lists must be in `sources.yaml`), `area.yaml` and the boundary copy it names, `boundary.json` (its schema, a closed ring, the record's feature ID, and the area's bounds), and every file in `evals/` (one per stage, `<stage>.yaml` or
`<stage>-<topic>.yaml`) against their schemas, checks that eval times use America/Chicago's
offset, and that grader fields, and every field a prompt names (written `` `$.field` ``), exist
in the stage's input or output schema. Each eval case's `route` must follow the routing above: an `accept`, or any case that expects a suggestion, whose source is always held, or whose given stage answers aren't both a plain `false` (a case that gives none counts as cleared), expects `reportItem`, and a suggestion needs an `accept` given. A case that expects `safety` never expects `accept`. The cases in `evals/curate-safety.yaml` and `evals/verify.yaml` that expect `safety` from an unlisted source will be the evidence that the models judge by meaning once the collector runs them.
CI runs the same check on every pull request; it checks the cases' structure and never calls a
model. Running the cases against a model is the collector's job (#272). Add an eval case whenever
the pipeline gets something wrong.
