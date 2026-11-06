# Note template

Copy this into `src/modules/<name>/README.md` (or a shared area of `src/platform/`), fill each
section, and delete the hints. At most 80 lines. Why it looks like this: decision
[0019](../architecture/decisions/0019-knowledge-layer.md).

Write only what the code doesn't show quickly. Field lists, props and routes are in the generated
reference (`docs/reference/`): link it, don't copy it. Every claim names the file or test it comes
from, so a reader can check it and a reviewer can see when it goes stale.

---

# <Module name>

<One or two sentences: what this module is for, for whom, and what it is not.>

## Screens

| Screen | Route     | Data comes from                                                     |
| ------ | --------- | ------------------------------------------------------------------- |
| <Name> | `/<path>` | <CMS collection, a global, code (hardcoded), or a shared component> |

## Behaviors and events

<What happens that the config doesn't show: hooks, jobs, emails, cache tags, time windows, limits.
One line each, with the file: "Publishing an event expires the `events` tag (`cms/hooks.ts`).">

## Shared pieces it uses

<Components, helpers and blocks from `src/platform/`, one line each. No module imports another
([0008](../architecture/decisions/0008-compose-modules-at-the-app-level.md)): where this module
meets another, name the composition root that joins them (a page in `src/app/`, the block
registry, or `src/payload.config.ts`).>

## Rules and the tests that protect them

<Each business rule in a sentence, with its test: "An event is upcoming until it ends in the site
timezone (`domain/upcoming.test.ts`).">

## Boundaries

<What it may import, what imports it (its `server.ts`, `client.ts`, `cms.ts`), what it must never
do.>

## Decisions

<Links to the decision records and issues that explain why it is this way.>

## Known gaps

<Open issues and limits a reader should know before changing it. "None" when there are none.>
