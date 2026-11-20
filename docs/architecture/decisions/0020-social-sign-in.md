# 0020: Sign in with Google through our own routes and `openid-client`

- **Date:** 2026-10-27, revised 2026-11-19 for Google only
- **Status:** Proposed (becomes Accepted when the owner confirms the approach, see Context)
- **Issues and PRs:** #188 and PR #505 (the build), #312 (the owner's Google app), #309 and #908
  (epics); the evaluation and its two reviews are on PR #261, which proposed this as record 0010
  (that number was taken since). The first version of this record took 0016, also taken since.

## Context

The owner wants neighbors to sign in with Google on the site's existing Payload accounts. Summary
of his direction (2026-10-21 and 2026-10-24, Claude Code sessions, recorded on #188): the library
is ours to choose after weighing security, maintainability and compatibility with the stack; the
agreed registration process stays as it is for email sign-up; and an email confirmation or a
social sign-in does not establish Sprecher East residency (#314). Facebook was part of the first
version of this record. He dropped it on 2026-11-11 (Claude session, recorded on #312 and #908),
and Apple and X stay off, since they cost money (#312).

What must not change: the `users` collection and its roles, `/admin`, the email and password
sign-in with Payload's own cookie (Secure in production, #234), the lockout, `auth.verify` and the
verify page (#187, #289, #303, #391), and `noPasswordSignInForAgents` (#336).

Payload 3.91 has no official social sign-in. The options PR #261 compared, from each package's
published code, the npm registry and the advisory database:

- **`payload-oauth2` 1.0.21:** keeps Payload's sign-in, but checks neither `state` nor `nonce`,
  rewrites the account on every sign-in, and its create can't skip the verification email. It
  needs about as much code from us as our own routes.
- **`payload-auth` 3.0.0 (Better Auth):** every provider by config, but it turns Payload's local
  sign-in off for every account, admins included, and `better-auth` had about twenty advisories
  (it would need `>=1.6.22`).
- **`payload-authjs` 0.10.2 (Auth.js 5, still beta):** turns the local sign-in off by default and
  forces text ids; four advisories in July 2026, two critical.
- **`payload-auth-plugin` 0.7.13:** no X, its own password fields, and it skips `email_verified`.
- **Our own routes with `openid-client`:** nothing of Payload's is replaced. `openid-client` is
  certified for OpenID Connect and checks `state`, `nonce`, PKCE and the ID token itself.

The owner's later direction on #312 (2026-11-05, Claude session) preferred established plugins and
libraries over custom OAuth code. This record keeps the provider code on the established
`openid-client` library, behind our own thin layer (the routes, the account rule and the session),
because the plugins read on #261 skip checks or replace Payload's sign-in. His 2026-11-19
directions (#188 and #313) keep PR #505 open and reuse its session code, but he has not yet
confirmed this approach, so the record stays Proposed until he does.

## Decision

- **Two routes per provider, in the accounts module, with `openid-client` 6.9.0**, pinned exactly (MIT, no
  advisories, one maintainer, panva, as for every candidate):
  `GET /auth/<provider>` starts a sign-in and `GET /auth/<provider>/callback` finishes it. They
  are Next.js routes in `src/app/(frontend)/auth/` that call the module's use cases, rather than
  Payload endpoints, so the code can use the module's data layer and Next's cookies like the rest
  of the accounts module.
- **Only Google, shaped for more.** Each provider is one entry in a table
  (`data/oauthProviders.ts`: issuer, scope, extra parameters) and in `domain/socialSignIn.ts`
  (its name, keys and subject field). Another OpenID Connect provider is a new entry, a new
  subject column and its tests, with no change to the flow. A provider that isn't OpenID Connect
  would need its own protocol code, which this record doesn't cover.
- **Payload's own session.** The callback signs the person in as Payload's `login` does once a
  password matched: a session on the account (`addSessionToUser`), Payload's token (`jwtSign`,
  `getFieldsToSign`) and Payload's cookie (`generatePayloadCookie`). Payload's `local-jwt` then
  reads it; no strategy is added. The callback answers a small page of ours that moves on to
  `/account` (a meta refresh and a link, no script) rather than a redirect: the provider's
  return is a cross-site navigation, and a redirect would carry that on, so Payload's CSRF check
  (`Sec-Fetch-Site`) would ignore the new cookie on the account page.
- **Google is on only when both its keys are set** (`GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET`). Without them the button doesn't show and the routes send the person
  back to `/login`.
- **This is our own code, the fourth step of the ladder** ([development](../../guidelines/development.md#native-first-then-plugins-then-our-code)):
  the plugin that keeps Payload's sign-in leaves the checks that matter to us anyway, and the
  others replace it. About 250 lines plus tests; the protocol is the library's.

## Consequences

**The rule** (`decideSocialSignIn`, a pure function with its tests):

- **The identity is the provider plus its subject** (`googleSub`), never the email. A returning
  person is found by it, and nothing on the account changes.
- **The subject column is unique**, so one provider account opens one account, even after a race.
  It is hidden and server-only (`serverOnlyFieldAccess`, #299).
- **No account is linked by its email.** Linking an existing account from `/account`, while
  signed in, is later work.
- **Google** is refused unless `email_verified` is exactly `true`. A new address gets a `guest`
  account created verified, with no verification email; an address an account already uses is
  refused, and the person is told to log in with their password or use "Forgot your password?".
  Google confirmed the email, so only its owner reads that.
- **Refused accounts:** a locked account (#140), an unverified one and an agent (#336) are never
  signed in to. The callback doesn't run Payload's `beforeLogin` and `afterLogin` hooks; the only
  one, `noPasswordSignInForAgents`, is checked by the rule itself.
- **Roles:** every create sets `role: 'guest'` and the context flag `socialSignIn`, and the
  `guestOnlyFromProviders` hook forces `guest` on such a create, after `firstAccountIsAdmin`, so a
  mistake can't grant more. The flag can only lower a role. A provider never sets residency
  (#314): `resident` is for a verified neighbor, and a Google account starts as a `guest` like an
  email sign-up does.
- **Limits:** a new account from a provider counts against the sign-up limits (5 per connection,
  20 site-wide per hour, separate counters). There's no robot check: the provider's own sign-in
  stands in for it.
- **OAuth-only accounts have no known password.** Change password on `/account` asks for the
  current one, so it isn't theirs to use; forgot password, which proves the inbox, is.

**The flow cookie:** `state`, a PKCE verifier and a `nonce`, signed, HttpOnly, SameSite=Lax (the
provider's return is a cross-site top-level GET, so Strict would drop it), ten minutes, cleared after
one use.
In production it is named with the `__Host-` prefix (Secure, `Path=/`, no `Domain`), as the passkey
cookie of decision 0021 is: without it, a page on a sibling subdomain (preview sites, #1079) could
plant a flow cookie it started itself, and the callback would then sign the victim in to the
attacker's Google account. It is signed with HMAC-SHA256 under a key derived from `PAYLOAD_SECRET`
for this purpose, so it never reads as a Payload token. Its flags and Payload's own auth cookie's
come from one helper (`data/authCookies.ts`), which reads them from `users.auth.cookies`, so every
sign-in path sets the same flags. Failures go to `/login?social=<code>` with a fixed message; the
provider's text is never shown, and a failure is logged as the error's class name only (for a
protocol failure, a class of `openid-client`), never Google's text (security guidelines). A Google
sign-in lasts Payload's two hours; "Keep me signed in" is not offered on it. Starting and finishing a sign-in count against a per-connection limit only
(`SOCIAL_SIGN_IN_LIMITS`), with no site-wide cap and no robot check. A site-wide cap would be
cheap to fill: a script can fetch a valid flow cookie from `/auth/google` and send it again for
its ten minutes, since the server keeps no record of it (the browser clears it after one use), so
a few dozen connections could switch Google off for every neighbor. What remains: a botnet can
make many requests, each limited per connection, and each costs at most one outbound call to
Google. `X-Forwarded-For` can't be spoofed behind Caddy, and a new account also counts against
the sign-up limits. The owner can ask for a robot check or a site-wide cap later (a recorded
trade-off on #188).

**Costs:** one dependency (`openid-client`, with `jose` and `oauth4webapi`) and our code to keep.

## Owner steps

The keys go in the server's `.env.local` through an `infra` issue, never in GitHub. The step by
step instructions are on #312.

- **Google** (free): Google Cloud Console → Google Auth Platform: an External consent screen with
  `openid`, `email` and `profile`, published, then a **Web application** client with the
  authorized redirect URIs `https://sprechereast.com/auth/google/callback` and
  `http://localhost:3000/auth/google/callback`. These scopes need no verification review. A
  separate development client, with only the local redirect URI, is better than adding it to the
  production client; that is a note on #312.

## Links

- PR #261 (evaluation, reviews 5621940301 and 5628806416), #188, #312
- `openid-client`: https://github.com/panva/openid-client
- Payload 3.91.0 read in `node_modules/payload`: `auth/operations/login.js`, `auth/sessions.js`,
  `auth/extractJWT.js`
- Google: https://support.google.com/cloud/answer/15549257 (redirect URI rules)
