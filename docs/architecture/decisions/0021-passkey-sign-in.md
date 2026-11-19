# 0021: Passkey sign-in on our own thin layer over `@simplewebauthn`

- **Date:** 2026-11-19
- **Status:** Proposed (becomes Accepted when the independent review says so)
- **Issues and PRs:** #1312 (this record), under the epic #313; the steps #1313 to #1318 follow it.
  The sign-in model is the Google sign-in record (PR #505, to become 0020 on `main`), which this
  record references and does not repeat.

## Context

Residents should be able to sign in with the screen lock of their phone or computer instead of
typing a password. Passkeys can't be phished and need no outside provider. Summary of the owner's
direction (2026-11-19, Claude session, voice then confirmed in text; recorded on #313):

- Passkeys come after Google sign-in, and reuse the session code that adds.
- The bar is well established, well maintained, no known vulnerabilities; our own small layer
  beats a small dependency that only half fits: a thin, tested layer on `@simplewebauthn`.
- Adding a passkey asks for a recent sign-in within a few minutes, the way large providers do,
  with no forced password.
- The steps stay low priority and ship switched off until the owner turns them on.

**What must not change:** Payload's login, `/admin`, the lockout (#140), sign-out, the Secure
cookie (#234), email verification and forgot password, and `noPasswordSignInForAgents` (#336).
Passkeys are another way in to an account a resident already has. They never create an account, set
residency (#314) or replace email recovery.

## What we considered

Taken on 2026-11-19 from the npm registry, the advisory database and each project's repository;
the table with the figures is on #313. Counts go stale, so only the verdicts are kept here.

- **Native and official:** Payload has no passkeys, Next.js ships no authentication, and there is
  no `@payloadcms/*` passkey package. Payload's key-value store doesn't fit challenges (below).
- **Community Payload plugins:** a small one wrapping Better Auth is young, with one maintainer
  and little use; `payload-auth-plugin` brings its own password fields (#261); `payload-authjs`
  has passkeys only in an unmerged pull request. None meets the bar.
- **Better Auth with its passkey plugin:** well used, but a second auth system with its own tables
  and sessions, and it wraps SimpleWebAuthn anyway. Its passkey plugin had a fixed advisory that
  let a signed-in user delete another person's passkey, so that case is a test here.
- **`@simplewebauthn/server` and `/browser`:** the WebAuthn library the others build on, in use
  since 2020, very widely downloaded, recent releases, no open advisory on the current version
  (one earlier advisory is fixed). Contains no Payload code.

## Decision

Our own layer in the accounts module, on `@simplewebauthn/server` and `@simplewebauthn/browser`.
This is the fourth step of the
[ladder](../../guidelines/development.md#native-first-then-plugins-then-our-code): nothing above it
fits without a second auth system or an unreleased change.

### Library and boundary

- Every call to the server library goes through one adapter in `data/` (`data/webauthn.ts`). The
  adapter takes and returns our plain types (options as JSON, the verified result as credential ID,
  public key, counter, transports, device type, backed-up flag). The domain and use cases never
  import the library. The browser package is used only in the sign-in and account screens'
  client code, behind a small helper, so a swap touches two files.
- Cryptography and the response checks stay in the library: signature, challenge, origin, relying
  party ID, user verification and the counter's direction. We never parse authenticator data.
  Ours, because the library never sees an account: the challenge's single use, the user-handle
  and credential-owner match, the account's state, the cap and the refusal of a framed answer.
- The adapter sets `residentKey` and `userVerification` to `required` itself (the library
  defaults to `preferred`), and a test asserts the options. It returns success only when the
  library says `verified === true`; any other result and every exception is the one fixed
  failure.
- Both are added in #1314 after the security guideline's package checks and `npm run audit:prod`.
  Versions are pinned exactly, and `npm audit signatures` is part of the check (both ship
  provenance). Their own dependencies sit under caret ranges held only by the lockfile.

### Relying party

- The relying party ID is the host of the configured site address (`getServerSideURL()`), and the
  expected origin is that address exactly: one value, never a list or a pattern, and no
  related-origins file is published. Neither comes from the request's Host or Origin header, the
  same rule as email links (accounts note).
- That gives the live domain in production, `localhost` in development and, in a preview, the
  preview's own configured address (see Previews). A browser lets a page on a subdomain ask for a
  parent domain's ID, so what keeps a passkey from working across places is our exact origin check.
- The feature refuses to start unless the host is a domain name (WebAuthn takes no IP address).
  Production requires HTTPS, so a missing site address, which falls back to `localhost`, turns the
  feature off. Development may use `localhost`.

### Kind of passkey

- **Discoverable credentials** required, so the resident doesn't type an email first.
- **User verification required** (the device's screen lock), and the library is told to require it
  too.
- **No attestation** (`none`): we don't need to know the device model, and asking for more adds
  privacy cost and certificate trust to maintain.
- Sign-in offers a button and, where the browser supports it, the passkey in the email field's
  autofill. Email and password stay on the same page.
- Registration excludes the account's existing credential IDs, so a device isn't added twice.

### Challenges

- **Random:** made by the library (at least the length the WebAuthn specification asks for).
- **Stored on the server** in a collection of its own (`passkey-challenges`): purpose (add or sign
  in), expiry, and the account for an add. Short expiry, a named constant.
- **Tied to the browser** by a signed cookie that carries only the row's identifier, built with
  `domain/signedValue.ts` under its own purpose key, so it never reads as another cookie or as a
  Payload token. Named with the `__Host-` prefix (Secure, `Path=/`, no `Domain`), so a preview
  subdomain can't plant or replace it; HttpOnly, SameSite=Strict, the challenge's lifetime. A
  challenge copied to another browser fails because that browser has no cookie.
- **Taken once** by the adapter's `updateOne` with a `where`, which puts the condition into the
  UPDATE itself: it sets `usedAt` where the identifier and purpose match, `usedAt` is empty and the
  expiry is in the future. Success only when a row comes back, so a replay, or two tries at once,
  succeed at most once, and it is taken before verifying, so a failed answer still uses it up. The pattern is `markConfirmed` in `src/modules/verification/cms/store.ts`.
  `payload.db.deleteOne` and the Local API's `delete` with a `where` read the row first and then
  delete by id, so both requests get it: they don't qualify. A test against real Payload runs the
  race (#1313).
- **Used and expired rows** are removed by a task on the existing retention queue (decision 0010).
- **Why not Payload's key-value store:** checked against Payload 3.91.0 (`package.json`), its
  database adapter stores `key` and `data` and nothing else, so no expiry, and its interface is
  `get`, `set`, `delete`, `has`, `keys` and `clear`. A get followed by a delete is two steps, so
  two requests can both read the challenge before either deletes it, as with `deleteOne` above.
  Neither need is met.

### What a stored passkey holds

- Credential ID (unique, indexed), public key, signature counter, transports, device type, backed-up
  flag, a label, when added, when last used, and the owning account.
- **User handle:** one random, opaque value per account, stored server-only and reused for every
  passkey the account adds; never the email or the database id. The `userName` shown in the
  passkey manager is the label. At sign-in we find the credential by its ID and require the
  answer's user handle to equal its owner's handle, or the one fixed failure follows.
- **Registration only inserts.** A credential ID already stored on any account refuses the add
  with the fixed failure; a save is never an upsert, so no one can replace another's key.
- No biometric data ever reaches us: the device checks it locally. The public key can't sign.
- Every field is server-only (`serverOnlyFieldAccess`), with no REST or GraphQL access for
  residents. A resident sees their own list through the module's use cases. Create and update are
  refused for everyone, admins included; admins read and delete for support only; they have no
  access to `passkey-challenges`. Only server code through the data layer writes. Deleting an
  account deletes its passkeys with a hook on `users`.
- The library refuses a counter that doesn't go up once either value is nonzero (synced passkeys
  that always report zero are allowed). The stored counter is written conditionally, only when the
  new value is higher, so two sign-ins at once can't lower it.

### Who may do what

- Only the signed-in account adds or removes its own passkeys. The account always comes from the
  session, never from the input; a passkey identifier from the browser is parsed again and
  accepted only when it belongs to that account. Removing another account's passkey is refused and
  leaves it in place.
- **Adding needs a recent sign-in,** and verifying the add requires the challenge row's account to
  equal the session's account and the session to still be recent at that moment, so the
  challenge's lifetime can't stretch the window: the session must be no older than
  `RECENT_SIGN_IN_WINDOW_MS`, a named constant in the accounts module's domain (a few minutes), so
  its number is set in code and not repeated here. An older session is asked to sign in again
  first, with whichever way the account has: a password sign-in, Google, or a passkey. This is not
  a password-first rule, so an account with no password is never forced to make one.
- **How the session's age is read:** Payload stores each sign-in as a session on the user with its
  own `createdAt`, and the token carries that session's id. The refresh operation only moves
  `expiresAt` of the same session (read in Payload 3.91.0, `auth/operations/refresh.js`), so
  `createdAt` is when the person signed in, and staying signed in with "keep me signed in" doesn't
  make an old session look new. The check finds the session whose id the verified token names and
  compares `createdAt` with now. A missing session, token without an id or unreadable time counts as
  not recent. The same check serves any later action that wants a recent sign-in.
- **Cap:** `MAX_PASSKEYS_PER_ACCOUNT`, a named constant. **Removing the last passkey is always
  allowed.**
- Add and remove each send a short email to the account's address, with what to do if it wasn't
  them (forgot password, then remove the passkey).

### Sign-in

- Locked (#140), unverified and agent (#336) accounts are refused, as in the Google sign-in
  record. The check runs after the library has verified the answer, on the credential's owner.
- Any answer with `crossOrigin: true` is refused: the library checks the top origin only when the
  browser sends it, and not every browser does. `/login` and `/account` also send
  `frame-ancestors 'none'`, since we never expect to be framed.
- **No account enumeration.** An unknown credential, a bad signature, a replayed or expired
  challenge, a wrong origin and a refused account all give the one fixed failure, in the message
  catalog, the way password sign-in answers wrong credentials. Because credentials are
  discoverable, sign-in options never name an account, so there is no email to probe.
- **Payload's own session.** Success starts a session through the code PR #505 adds, moved into
  `data/session.ts` in #1315 as its second use: a session on the account, Payload's token and
  cookie, read by `local-jwt` with no strategy added. "Keep me signed in" is honored through
  `data/rememberedSession.ts`, as password sign-in does. A passkey sign-in starts a new session, so
  it counts as a recent sign-in.
- Unlike providers, a passkey sign-in is a same-site request from our own page, so the continue
  page the Google record needs for the cross-site return isn't needed and the CSRF check is unaffected.
- The counter and last-used time are updated after a good answer.

### Limits

- Asking for a challenge is limited per connection and site-wide, reusing `createRequestGuard`
  (`use-cases/guardPublicRequest.ts`) and `SlidingWindowCounter`, with their own counters and
  named limits. Past the count the answer is a fixed message.
- No robot check: the answer needs a real authenticator holding a registered key, so guessing
  gains nothing; the limits only keep challenge requests from piling up.

### Recovery

Email and password, and forgot password, are never turned off by passkeys. Losing every passkey
never locks anyone out: forgot password gets them back in, and from there they remove the lost
passkey. A passkey is never the only way into an account, and there is no account made from a
passkey. The screens and the accounts note say this plainly.

### The switch

One server setting turns the feature on, read in one place and off by default. Off, no button
or card shows, the routes and actions refuse with the same fixed failure, and the library isn't
called. It holds no secret and lives in the server's environment file, turned on through an `infra`
issue (#1318) once the end-to-end journeys pass (#1317). Rolling back is turning it off:
saved passkeys stay stored and unused.

### Previews

A preview's relying party ID and origin come from its own configured site address, never from the
host a request names. Passkeys made there work only there, and production's never work in a
preview, because production's expected origin is exactly one value. A preview with no usable
address leaves the feature off. Using the live passkeys in a preview is out of scope (#1079).

## Consequences

- **Logging:** only an error code or a fixed reason is logged, never the browser's answer, the
  challenge, the cookie, a public key or an email: the library's messages carry the challenge and
  origin.
- **Easier:** one-touch sign-in, nothing phishable stored, no outside provider; Payload's session
  keeps the lockout, `/admin` and sign-out as before. **Harder:** two collections, a migration, two
  packages and our own code to keep.
- **Residual risk.** Someone in the middle of a password sign-in gets a new session, so the
  recent-sign-in check can't stop them adding a passkey, and that passkey then renews itself, since
  a passkey sign-in counts as recent. The control is the notification email: it names the passkey's
  label and the time, and holds no sign-in link. Removing a passkey doesn't end the sessions it
  started; forgot password does (Payload's reset empties the sessions). Asking for a recent
  sign-in before a remove too is open for the owner, who decided the step only for adding.
- **Single-maintainer risk.** `@simplewebauthn` has one npm maintainer, as did every candidate and
  `openid-client` in the Google sign-in record. If it is abandoned or compromised:
  - the adapter is the only importer of the server package, with a small port of our own types, so
    another WebAuthn library is a rewrite of that one file, behind the same tests;
  - the stored shape is the standard one (credential ID, COSE public key, counter, transports), so
    saved passkeys survive a swap;
  - versions are pinned, `npm run audit:prod` and `npm audit signatures` watch it, a Dependabot
    bump of these two packages gets the top-level review rather than a routine merge, and a bad
    release can be held back or the switch turned off.
- **Cost of a mistake:** a bug could sign in the wrong account, hence the top review level and
  tests first (#1313, #1315, #1317).

## Links

- Epic #313 (comparison and sign-off in its comments), steps #1313 (storage, rules), #1314 (add),
  #1315 (sign in), #1316 (see and remove), #1317 (end to end), #1318 (turn on)
- The Google sign-in record (PR #505, to become 0020), 0010 (retention);
  `src/modules/verification/cms/store.ts` (`markConfirmed`)
- WebAuthn Level 3: https://www.w3.org/TR/webauthn-3/ (relying party ID, challenge, user
  verification, attestation)
- SimpleWebAuthn: https://simplewebauthn.dev/docs/ and https://github.com/MasterKale/SimpleWebAuthn
- Payload 3.91.0 read in `node_modules/payload`: `kv/index.d.ts`, `kv/adapters/DatabaseKVAdapter.js`,
  `auth/sessions.js`, `auth/operations/refresh.js`; `@payloadcms/drizzle` `deleteOne.js`
