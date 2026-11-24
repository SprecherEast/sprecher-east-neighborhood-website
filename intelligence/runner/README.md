# Intelligence runner

Runs the pipeline in [`../`](../README.md) once: scout the pilot sources, take each new or changed
item through verify, curate and draft, and submit suggestions and review items to the CMS
(#364). Fetching, parsing, hashing, schema checks, routing and submitting are code here; only the
three model stages go to a model, through one adapter function.

It is not site code: the website never imports it, and it has its own dependencies.

## Run it

```bash
cd intelligence/runner
npm ci
node run.mjs --dry-run --digest digest.json   # reads the CMS if a key is set, writes nothing
node run.mjs                                   # a real run
node run.mjs --refresh-boundary                # rewrites ../boundary.json from the City's layer
npm test                                       # unit tests and the scout and submit evals
```

| Setting                       | What it is                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `SPRECHER_EAST_MCP_KEY`       | The `agent` account's API key (Admin → Agents → API Keys). Never commit it.                    |
| `SPRECHER_EAST_MCP_URL`       | Default `https://sprechereast.com/api/mcp`                                                     |
| `SPRECHER_EAST_MODEL_COMMAND` | JSON argv that starts the OpenClaw CLI, default `["openclaw"]`                                 |
| `SPRECHER_EAST_AGENT_ID`      | The OpenClaw agent for the model stages, default `sprecher-east`                               |
| `SPRECHER_EAST_STATE`         | State file (ETags, cursors, items handled), default `~/.sprecher-east-intelligence/state.json` |

On Windows, set `SPRECHER_EAST_MODEL_COMMAND` to the node and `openclaw.mjs` paths (npm's
`openclaw.cmd` shim can't be started without a shell, which the runner never uses). Update the
checkout before each run (`git pull --ff-only`), so `repoCommit` names the prompts on `main`; a
real run refuses to start outside a git checkout.

The run prints one line (what was suggested, sent for review, deferred, and errors) and exits 1
only when the run failed; the run log is in Admin → Agents → Agent Runs.

## How the parts fit

| File                  | Does                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `lib/contract.mjs`    | Loads and checks `pipeline.yaml` and `safety.yaml` against their schemas, with `sources.yaml`, `coverage.md`, the prompts |
| `lib/fetchSource.mjs` | Direct fetch: ETag and Last-Modified, 3 redirects, one retry, gates, robots.txt                                           |
| `lib/parsers.mjs`     | Legistar events and matters (JSON), RSS and Atom; `lib/ics.mjs`: iCalendar via ical.js                                    |
| `lib/html.mjs`        | The HTML pages with no feed (#390): City article lists, City meetings, WisDOT meetings                                    |
| `lib/scout.mjs`       | Candidates with `externalId`, `contentHash` and `change`; the Legistar area filter                                        |
| `lib/model.mjs`       | The model adapter: OpenClaw (`openclaw agent --agent … --json`), or a fake for tests                                      |
| `lib/stages.mjs`      | One stage: prompt + coverage + item, schema check, one retry; verify's escalation, the promotion guard                    |
| `lib/gate.mjs`        | The one gate: what may be accepted and which tool it goes to; `lib/safety.mjs` reads the source list of `safety.yaml`     |
| `lib/submit.mjs`      | Runs the gate, then the MCP envelope, validation, one retry, follow-up review and image reports                           |
| `lib/cms.mjs`         | The MCP client with the key, the dry-run CMS, and `withoutSuggestions`, the client with no submit                         |
| `lib/boundary.mjs`    | The dated copy of the City's boundary: checks, point in polygon, age, refresh from the layer                              |
| `lib/geocode.mjs`     | A street address in a text, and the City's own address locator (no key); only the street address is sent                  |
| `lib/place.mjs`       | After verify: places the item by the boundary or the word match, and records `verification.placement`                     |
| `lib/pipeline.mjs`    | One run: kill switch and the run log; `lib/process.mjs`: budgets, state, items, failures                                  |

## Placement by the City's boundary (#1009)

After verify answers, `lib/place.mjs` reads one street address from the item (verify's
`location.address`, else the candidate's `locationText`), asks the City's own locator for its
point, and tests the point against `../boundary.json`. It adds `verification.placement` with the
method: `boundary` (inside or outside), `word-match` (no address resolved, so verify's tier by
the area's words stands) or `unplaced` (the item names no place). Reports for an editor say it.

- **Authority.** When an address resolves, the boundary decides inside or outside: inside is
  `core` (a `catchment` tier is simply raised, since curate accepts both alike; an `unknown` one
  only when the street is verify's own `location.address`, `location.verified` is true and
  verify's `location.municipality` is Madison), and
  `core` is never kept for an address outside (it becomes `unknown`). Any
  other change adds `ambiguous-location`, which the promotion guard holds for a person:
  placement never makes an item easier to accept than verify allowed. A point on the edge counts
  as inside. Outside, catchment versus citywide versus outside stays verify's judgment.
- **Falls back, never fails.** No address, two addresses, a municipality other than Madison,
  Wisconsin (verify's, or anything in the text the street came from that doesn't tie it to Madison: another town, a state or ZIP before the street, a long unit or a non-Madison ZIP after it), a `similar-name` or `prompt-injection` flag, no match, a weak match (score under
  `minScore`), strong matches in different places, a failing or slow locator, or the run's limit:
  all keep the word match, with the reason in `placement.reason`. The text rule is strict on purpose: an ordinary suffix such as a parenthetical or "behind the shelter" keeps the word match too, to be tuned on real misses. An address that is not a plain street is a reason, never a request. A failing locator is logged once
  in the run and stops after two failures in a row.
- **Safety.** Placement never reads or writes `safety`; the gate decides it as before.
- **What leaves the machine.** One GET per address to
  `maps.cityofmadison.com/arcgis/rest/services/Locators/AddressPoints_w_Unit/GeocodeServer`, with
  only a house number, street and street type: no retry, no wait for `Retry-After`, and no redirect
  followed (a redirect counts as a failure). At most `maxPerRun` requests per run (each one a
  single GET, so each counted), 10 s
  timeout, 100 KB answer, none after the run's deadline. No key, no cost, no other service. The
  settings are in `area.yaml`, `boundary`. The run log never holds an address or a URL from it.
- **The copy.** `boundary.json` is the one feature (`NA_ID` 146) of the City's Neighborhood
  Associations layer, about 3.5 KB, kept in the repo so a run needs no request for it. The City
  says the layer's boundaries are self-reported by the associations. The copy must lie inside
  the box in `area.yaml` (`bounds`), and a refresh takes only a feature with the record's ID and
  name. A run's log says when the
  copy is older than `maxAgeDays` (365); then run `node run.mjs --refresh-boundary` and open a
  pull request with the diff. A copy that fails its checks stops the start.

## Not built yet

- **The Playwright fallback** (#352): no pilot source needs it. The four HTML sources (#390) are
  read directly, each by its own parser in `lib/html.mjs`; a source without a parser is logged as
  `skipped`, and its evals are skipped in the tests.
- **Cost in dollars**: runs use the owner's flat subscription, so `cost.usd` is 0; token counts
  are logged only if OpenClaw reports them, which its docs don't promise.
