# 0003: Cloudflare Turnstile for public forms, failing closed

- **Date:** 2026-10-19
- **Status:** Accepted
- **Issues and PRs:** #112, #113, #117

## Context

The public contact form needs protection from bots without making residents solve puzzles.

## Decision

- Cloudflare Turnstile in managed, interaction-only mode: most visitors never see it.
- The server verifies every token with Cloudflare's Siteverify API, as a Payload hook on
  `form-submissions`, so it applies to the page, REST and GraphQL alike. A token passes only with
  `success`, our action (`form-submission`) and a hostname on the allowlist. Cloudflare's test
  secrets (for local work) skip the action and hostname checks.
- Any error (no token, Cloudflare unreachable, timeout) rejects the submission: fail closed.
- No client IP is sent (`remoteip` is optional, and `X-Forwarded-For` isn't trustworthy until #118).
- The check is on only when both keys are set; a build with only one key fails.
- Staff (admins and editors) skip the check.

## Consequences

- Bots are stopped without friction for people; Cloudflare is a dependency for form submissions.
- If the secret disappears after a good build, submissions are accepted and an error is logged
  (fail open at runtime); this trade-off is open for the owner to revisit.

## Links

- Cloudflare server-side validation (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- Deploy gate for missing keys: #869, and the "Robot check keys in production" entry in `docs/guidelines/security.md`
- Code: `src/platform/lib/humanCheck.ts`, `src/platform/turnstile/turnstileVerifier.ts`,
  `src/modules/contact/cms/verifyHumanSubmission.ts`
