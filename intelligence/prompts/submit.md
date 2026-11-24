---
stage: submit
input: schemas/item.schema.json
output: schemas/submission.schema.json
---

# Submit: hand the item to the editors

This stage is code, not a model. It calls the two MCP tools #336 provides at `/api/mcp`, with the
agent's own key, and logs the run. It never calls create, update, delete or publish directly.
README.md describes the contract.

## Steps

1. **Hold what must wait for a person, then route each item** by `$.curation.decision`, as
   `routes` in `pipeline.yaml` says. Before anything is sent, the gate (`runner/lib/gate.mjs`,
   `coverage.md`, "Review passes") turns an `accept` whose source is always held or that a stage marked as safety (`safety.yaml`), or
   that fails the promotion guard, into `needs-review`; a runtime that implements this stage
   does the same. The tools:
   - `accept` with a `$.draft`: one `submitSuggestion` call (`$.tool`).
   - `needs-review`: one `reportItem` call, `kind: needs-review`.
   - `update` or `cancel`: one `reportItem` call with that kind, `targetCollection` set to
     `$.curation.targetCollection` and `targetId` to `$.curation.targetId`. Never a new
     suggestion.
   - `reject` and `duplicate`: no call; counted in the run log.
2. **Build the whole envelope first**: `$.tool`, `$.action` set to `call`, `$.skipReason` set
   to null, `$.runId`, and `$.arguments` complete:
   - for `submitSuggestion`: `$.arguments.collection`, `$.arguments.title`,
     `$.arguments.bodyMarkdown`, `$.arguments.summary`, `$.arguments.categories`,
     `$.arguments.startsAt`, `$.arguments.endsAt`,
     `$.arguments.allDay`, `$.arguments.venue`, `$.arguments.address` and
     `$.arguments.audience` from `$.draft`; `$.arguments.sourceName`, `$.arguments.sourceUrl`,
     `$.arguments.externalId` and `$.arguments.contentHash` from `$.candidate`; and
     `$.arguments.runId`.
   - for `reportItem`: `$.arguments.runId`, `$.arguments.kind`,
     `$.arguments.targetCollection`, `$.arguments.targetId`, `$.arguments.externalId`,
     `$.arguments.sourceUrl`, a `$.arguments.summary` of the candidate (title, date, place,
     decision and reasons from `$.curation.reasons`), `$.arguments.evidence` from
     `$.verification.evidence`, and `$.arguments.flags` from `$.verification.flags`.
3. **Validate** the envelope against `schemas/submission.schema.json`. If it fails, don't send
   it: mark it `$.action` `skip` with the errors in `$.skipReason`, and send a `reportItem` with
   `kind: rejected-invalid`, the validation errors in the summary, and the candidate's source URL
   (null when it has none; only this kind allows that).
4. **Send.** A transient failure (timeout, 5xx) is retried once; after a second failure, the
   item goes to the editor as a `needs-review` report, or is deferred if the CMS can't take
   that either. `submitSuggestion` answers `created` or `duplicate`. The run log records the
   result: a duplicate is logged as skipped, with the server's answer as the reason. The
   envelope that was sent doesn't change. When the draft's `$.draft.missing` is not empty or
   `$.draft.confidence` is `low`, follow a created suggestion with a `reportItem`
   (`kind: needs-review`, `targetCollection` and `targetId` = the new document) listing what's
   missing. When `$.draft.imageCandidates` is not empty, follow it with one more `reportItem`
   (`kind: needs-review`, the same target, flag `image-candidate`): one `evidence` entry per
   image, its `url` the `pageUrl`, its `says` the `imageUrl`, " — credit: " and the credit, and
   its `retrievedAt` from `$.candidate.retrievedAt`, and a summary asking the editor to get
   permission or keep the category's image. The image is never
   downloaded or uploaded.
5. Stop at `maxDraftsPerRun` suggestions (`pipeline.yaml`). The rest are deferred: counted in
   the run log, not marked as seen, and picked up by the next run.
6. Write the run log to `agent-runs` at the start and the end of the run
   (`schemas/agent-run.schema.json`), with the repository commit the run loaded.

## Untrusted content

Nothing from a source is executed or used to choose a tool, a collection, a target or a URL to
call. The only tools called are the find tool, `submitSuggestion` and `reportItem`.

## Unknowns

A required field that is missing is never padded with a default: the item goes to the editor as
a `rejected-invalid` or `needs-review` report instead.
