# 0017: One message catalog in code, durations from the real settings

- **Date:** 2026-11-01
- **Status:** Accepted

## Context

The messages residents read after sending a form were long, wrote times by hand ("24 hours", "one
hour") next to the setting that decides them, and could drift from it. The owner (2026-11-01,
voice session with Claude, quoted on #551): the copy must sound like a human who understands the
neighborhood, durations must come from the real settings,
and the messages should live in one place, in code, so they can be translated later.

Native first (#551): Payload's CMS holds editor content, not interface text tied to security
behavior. `Intl.DurationFormat` gives "1 hour" or "1 hr", not "an hour" or "a day", and isn't in
every runtime we target, so `formatDuration` is a small hand-written English table. A translation
will need a locale-aware version. No i18n library is needed for one language yet.

## Decision

- `src/platform/lib/messages/` is the one catalog: typed keys, whole sentences, `{blank}` values
  filled by `message(key, values)`. A missing value throws.
- `formatDuration()` turns a setting into words ("an hour", "a day"). Link lifetimes are constants
  (`CONFIRMATION_LINK_LIFETIME_MS`, `RESET_LINK_LIFETIME_MS`) used by the link and by its message.
- A test fails when a catalog sentence hard-codes a time or runs past 30 words.
- The contact form's own thank-you heading stays in the CMS (the form's `confirmationMessage`).

## Consequences

Changing a lifetime changes the message with it. Translating means replacing sentences, not
fragments. Messages not yet moved (#551, next PRs) still live next to their components.

## Links

#551, #501
