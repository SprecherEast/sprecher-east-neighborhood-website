# 0016: One service helper; no use case for a plain read

- **Date:** 2026-10-31
- **Status:** Accepted

## Context

Thirteen files in `use-cases/` only passed a call to the `data/` query beside them
(`findFaqEntries`, `listPostSlugs`, `getHeaderNav`…), while real use cases repeated the same
try, catch and log. The owner (2026-10-31, voice session with Claude, quoted on #521): "let's
create a centralized implementation that's going to handle everything on our application side.
So it'll be a very lightweight server service thing wrapper that can be plugged into more things
in the future."

Native first (#521): Payload's `hooks.afterError` runs only for REST and GraphQL requests, never
for the Local API calls our pages make. Next's `error.tsx` is a screen, and logs nothing on the
server. `loading.tsx` has nothing to wait for on static pages. None catches and logs a failed
server call.

## Decision

- A use case exists only where there is logic of its own: who is asking, a rule, a combination of
  reads. A plain read has none: `server.ts` exports it straight from `data/`, and a server
  component in `ui/` (`SiteHeader`, `SiteFooter`) may read `data/`. Client components still never
  import `data/` (rule 5).
- `src/platform/service/` holds the one helper: `runUseCase(action, run, fallback)` for a call
  that must not throw, and `runAction(action, run, toFailure)` for a server action answering with
  an `ActionResult`. Both log a failure with `logServerFailure`: the action and the error's class
  name, never the error, which can carry the query's values.
- Timing, request IDs or retries, if ever needed, are added inside these two functions. A client
  request interceptor and a global loading indicator are out until a slow service needs them.

## Consequences

- Fewer files to open to follow a read; one place for catching and logging.
- A page's read that throws still reaches Next's error handling, as before: `error.tsx` for the
  page, and `global-error.tsx` for the root layout's header and footer reads.
- **Trade-off for the owner:** plain reads don't go through the helper (wrapping them in a
  catch-and-fallback would hide an outage as an empty list), so timing, request IDs or retries added
  to `runUseCase` and `runAction` later won't cover them.
- Nothing in lint tells a read from a write, so that `server.ts` exports only reads from `data/` is
  checked in review alone.
- A plain read that later needs a rule gets a use case then.

## Links

- #521; [0002](0002-no-repository-layer.md)
