# Agent access

How the neighborhood agents (#255) read the site's content and suggest events and posts (#336).
They use Payload's official MCP plugin (`@payloadcms/plugin-mcp`) at `/api/mcp`; the `agents`
module (`src/modules/agents/`) holds its options, two tools of ours and the run history. What
they suggest waits in the [review queue](review-queue.md) until staff publish it.

## Who can do what

An admin creates an account with the `agent` role, then an API key for it in Admin (Agents → API
Keys). Each MCP request sends the key (`Authorization: Bearer <key>`) and acts as that account,
so collection access decides, and the key's checkboxes can only narrow it. An agent has these
tools and nothing else:

| Tool                                                  | What it does                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `findEvents`, `findPosts`, `findCategories`           | Published events and posts, and categories, as allowlisted fields          |
| `submitSuggestion`                                    | Stores an event or post as an unpublished draft with status `suggested`    |
| `reportItem`                                          | Adds an item for an editor to the agent's run; never changes the content   |
| `createAgentRuns`, `findAgentRuns`, `updateAgentRuns` | Its own runs only: start one, resume from the last cursors, record the end |

The plugin's raw `create` is off for events and posts: `submitSuggestion` covers it, with the
Markdown conversion and the duplicate answer. No update, publish or delete of content, and no
`users`, `form-submissions` or other collection.

The arguments are the agents' contract in `intelligence/schemas/` (`suggestion.schema.json`,
`report.schema.json`, #344, #355); `cms/tools/schemas.ts` checks the same names, formats and caps.
`cms/tools/schemas.contract.test.ts` gives samples (the submit evals' items among them) to both
the JSON Schemas and the Zod schemas and expects the same verdict, and checks that the lists of
values and the run fields match, so the two can't drift apart silently.

### `submitSuggestion`

Arguments: `collection` (`events` | `posts`), `title`, `bodyMarkdown`, `summary` (1–160
characters, the card text), `categories` (1–2 category slugs), `startsAt`, `endsAt`,
`allDay`, `venue`, `address`, `sourceName`, `sourceUrl`, `externalId` (`<source id>:<id>`),
`contentHash` (sha256, lowercase hex), `audience` (the `AUDIENCES` values, each once) and `runId`
(the `runId` of one of its own runs). The Markdown becomes the collection's `content` through
Payload's converter (`convertMarkdownToLexical`) with that field's own editor config. A
`<Chart kind="…" title="…" summary="…" unit="…" data={[…]} />` tag becomes a chart block (#640):
its props are checked with the same `ChartSpec` rules as the editor's block, and a tag that breaks
them refuses the whole call with the reasons (`Invalid <Chart>: …`), so the agent can fix it. The
tag is in `intelligence/prompts/draft.md`. A chart shows small, with its `summary` beside it, so keep
the `summary` to one line inside a `<FactTabs>` (#681). A `<FactTabs tabs={[…]} />` tag becomes a fact tabs block
(#664) the same way: its tabs, with nested chart and timeline pictures as plain JSON, are checked
with the editor's limits, the chart rules and the one link rule, and a bad one is refused with
`Invalid <FactTabs>: …`. Payload drops the whole body when it can't find where a tag ends, so
`submitSuggestion` counts the `<Chart` and `<FactTabs` openings against the blocks and refusals and
refuses the call, naming the tag, when one was neither. For an
event, `startsAt` is required (a date-time with a zone); it gives `date` and, unless `allDay`,
`timeStart` and `timeEnd` in the site timezone (`toEventSchedule`); `venue` and `address` give
`locationName` and `locationAddress`. The summary becomes an event's `description` or a post's
`meta.description`, the text cards show (#363). The slugs are looked up in the category tree events
and posts share (#362); one that isn't there refuses the whole call, and the agent never creates
a category. The draft gets the first category's `defaultImage`, or the nearest one up its parents,
then the same for the second category (`pickDefaultImage`), as `heroImage` and, for a post,
`meta.image`; with none, cards show the placeholder until an editor picks one. Images on the
source's pages only reach the editor as links in a `reportItem` with the `image-candidate` flag;
the agent never uploads media. It runs as the agent (`overrideAccess: false`), and
`holdSuggestions` keeps it a draft. It answers `{"status":"created","id"}`, or
`{"status":"duplicate","id"}` when an item with the same `externalId` or `contentHash` is stored.
The run's counts are the agent's to keep in its run log; the tool doesn't change them.

### `reportItem`

Arguments: `runId`, `kind` (`needs-review`, `update`, `cancel`, `rejected-invalid`),
`targetCollection` and `targetId` (an integer; ids are per collection, so the collection is
required with an id, and an `update` or `cancel` names both), `externalId`, `summary`,
`evidence[]` (`url`, `says`, `retrievedAt`), `flags[]` (the contract's flag values) and
`sourceUrl` (null only for a `rejected-invalid` report whose item had no link). Each report is its own document in `agent-review-items`, linked to the run, so two
reports at once both land. Staff read and filter them in Admin (Agents → Agent Review Items, and
under each run); the agent reads its own, can't change or delete them, and only reports on its
own runs.

**Size caps** (`SUGGESTION_CAPS` in `domain/suggestion.ts`; the tool refuses anything larger):
`runId` 100, title 60 (the CMS's `TITLE_MAX_LENGTH`), body 12,000 (room for a long explainer with `<Chart>` tags, #640), venue 200, address 300, source name 200, links 2,048,
`externalId` 200, summary 1,000, 5 evidence items with `says` up to 500, 20 flags.

## Safeguards

- **Keys** (`cms/apiKeys.ts`): admin-only, and bound only to `agent` accounts. A key stops
  working when its account is no longer an agent (`checkAgentKey` in `cms/mcp.ts`).
- **No personal data to the model** (`domain/agentView.ts`): every find answer is rebuilt from
  an allowlist of fields per collection (`cms/agentViews.ts`, checked against the generated
  types, so a renamed field fails `tsc`); related documents become ids; no authors, emails or
  rich text. The two tools answer only a status and an id.
- **Limits** (`domain/mcpLimits.ts`): 120 requests a minute per connection, counted before the
  key is looked up, so guessing keys is slow; then 60 a minute per key. Past either, 429. Caddy caps request
  bodies at 256 KB (`ops/caddy/form-limits.caddy`).
- **No password**: agent accounts can't sign in with a password
  (`accounts/cms/noPasswordSignInForAgents.ts`), so the key is their only credential.
- **Keys as principals**: Payload also lets a key authenticate a REST request as the key document
  itself. Role checks (`platform/payload/roles.ts`) and the site's session lookup trust only
  `users`, so such a request counts as signed out.

## Run history (`agent-runs`)

The fields of `intelligence/schemas/agent-run.schema.json`: `runId` (unique), `agentName`,
`pipelineVersion`, `repoCommit` (40 hex), `startedAt`, `finishedAt`, `status` (`running`,
`succeeded`, `partial`, `failed`, `stopped-budget`, `disabled`), `sourcesChecked` (`sourceId`,
`fetchStrategy` (`direct`, `playwright`, `none`), `cursor`, `status` (`ok`, `not-modified`,
`error`, `skipped`, `blocked`), `error`), `counts` (`seen`, `proposed`, `updates`, `rejected`,
`duplicates`, `needsReview`, `deferred`), `errors` and `cost` (`inputTokens`, `outputTokens`,
`usd`). A run's identity (`runId`, `agentName`, `pipelineVersion`, `repoCommit`, `startedAt`) is
written once: an agent's later updates keep the stored values. Ours on top: `agent`,
set by the server to the agent that created the run, and `reviewItems`, a join showing the run's
items from `agent-review-items`. Admins read every run in Admin (Agents → Agent Runs); an agent reads only its own,
to pick up its cursors. Runs, keys and suggestions are in the Payload database, so the backups
(#148) cover them.

Tests: `src/modules/agents/domain/*.test.ts`, `src/platform/payload/accessPolicy.test.ts`,
`src/payload.config.agentAccess.test.ts` and `src/payload.config.agentTools.test.ts` (real MCP
requests on in-memory SQLite).
