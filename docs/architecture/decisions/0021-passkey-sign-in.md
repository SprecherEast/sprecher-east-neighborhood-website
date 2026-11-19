# 0021: Passkey sign-in on our own thin layer over `@simplewebauthn`

- **Date:** 2026-11-19
- **Status:** Proposed (becomes Accepted when the independent review says so)
- **Issues and PRs:** #1312 (this record), under the epic #313; the steps #1313 to #1318 follow it.
  The sign-in model is the Google sign-in record (decision 0020, PR #505), which this record
  references and does not repeat.

## Context

Residents should be able to sign in with the screen lock of their phone or computer instead of
typing a password. Passkeys can't be phished and need no outside provider. Summary of the owner's
direction (2026-11-19, Claude session, voice then confirmed in text; recorded on #313):

- Passkeys come after Google sign-in, and reuse the session code that adds.
- Choose by the owner's bar: well established, well maintained, no known vulnerabilities; our own
  small layer beats a small dependency that only half fits.
- Our own thin, tested layer on `@simplewebauthn`, in the accounts module.
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

- **Native:** Payload has no passkeys and Next.js ships no authentication. Payload's key-value
  store was checked for challenges and does not fit (see Challenges).
- **Official plugins:** no `@payloadcms/*` passkey package.
- **A small Payload plugin wrapping Better Auth:** keeps Payload's login screen, but is young, has
  one maintainer and little use. Fails the bar; a reference only.
- **`payload-auth-plugin`:** brings its own password fields (#261). Fails the bar for passkeys alone.
- **`payload-authjs`:** passkeys exist only in an unmerged pull request.
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
- Cryptography, attestation and assertion checks (signature, origin, relying party ID, flags,
  counter) stay in the library. We never parse authenticator data ourselves.
- Both are added in #1314 after the security guideline's package checks and `npm run audit:prod`.

### Relying party

- The relying party ID is the host of the configured site address (`getServerSideURL()`), and the
  expected origin is that address exactly. Neither comes from the request's Host or Origin
  header, the same rule as email links (accounts note). A request that arrives on another host
  fails the library's origin check instead of being trusted.
- That gives the live domain in production, `localhost` in development and, in a preview, the
  preview's own address (see Previews). A passkey is bound by the browser to its ID, so one made in
  one place never works in another.
- WebAuthn only runs in a secure context. The feature refuses to start when the configured address
  is neither HTTPS nor `localhost`.
- The rule is pure code in `domain/passkeys.ts` and tested; the adapter receives the two values.

### Kind of passkey

- **Discoverable credentials** required, so the resident doesn't type an email first.
- **User verification required:** the screen lock or biometric on the device; the library is told
  to require it too, so a response without it fails.
- **No attestation** (`none`): we don't need to know the device model, and asking for more adds
  privacy cost and certificate trust to maintain.
- Sign-in offers a button and, where the browser supports it, the passkey in the email field's
  autofill. Email and password stay on the same page.
- Registration lists the account's existing credential IDs as excluded, so a device can't be added
  twice.

### Challenges

- **Random:** made by the library (at least the length the WebAuthn specification asks for).
- **Stored on the server** in a collection of its own (`passkey-challenges`): purpose (add or sign
  in), expiry, and the account for an add. Short expiry, a named constant.
- **Tied to the browser** by a signed cookie that carries only the row's identifier, built with
  `domain/signedValue.ts` under its own purpose key, so it never reads as another cookie or as a
  Payload token. HttpOnly, SameSite=Lax, Secure in production, the challenge's lifetime.
  A challenge copied to another browser fails because that browser has no cookie.
- **Taken once:** one conditional delete matching the identifier, the purpose and an unexpired
  time, which returns the row it removed. Zero rows means the answer is refused. A replay, or two
  tries at once, can therefore succeed at most once; a test against real Payload proves the race
  (#1313). It is the pattern record 0009 uses for confirmation links (one conditional update).
- **Expired rows** are removed by a task on the existing retention queue (decision 0010).
- **Why not Payload's key-value store:** checked against Payload 3.91.0 (`package.json`), its
  database adapter stores `key` and `data` and nothing else, so no expiry, and its interface is
  `get`, `set`, `delete`, `has`, `keys` and `clear`. A get followed by a delete is two steps, so
  two requests can both read the challenge before either deletes it. Neither need is met.

### What a stored passkey holds

- Credential ID (unique, indexed), public key, signature counter, transports, device type, backed-up
  flag, a label, when added, when last used, and the owning account.
- No biometric data ever reaches us: the device checks it locally. The public key can't sign.
- Every field is server-only (`serverOnlyFieldAccess`), with no REST or GraphQL access for
  residents. A resident sees their own list through the module's use cases. Admins can see and
  delete passkeys for support. Deleting an account deletes its passkeys with a hook on `users`.
- The counter is updated on every use; the library refuses a counter that goes back once an
  authenticator reports one (many synced passkeys always report zero, which is allowed).

### Who may do what

- Only the signed-in account adds or removes its own passkeys. The account always comes from the
  session, never from the input; a passkey identifier from the browser is parsed again and
  accepted only when it belongs to that account. Removing another account's passkey is refused and
  leaves it in place.
- **Adding needs a recent sign-in:** the session must be no older than
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

- Locked (#140), unverified and agent (#336) accounts are refused, as in decision 0020. The check
  runs after the library has verified the answer, on the account the credential belongs to.
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
  page decision 0020 needs for the cross-site return isn't needed and the CSRF check is unaffected.
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

A preview takes the address it is served from as its configured site address, so its relying party
ID and origin are its own. Passkeys made there work only there, and production's never work in a
preview. A preview with no usable address (not HTTPS) leaves the feature off. Using the live
passkeys in a preview is out of scope (#1079).

## Consequences

- **Easier:** a resident signs in with one touch; nothing phishable is stored; no outside provider,
  keys or cost. Payload's session means the lockout, `/admin` and sign-out work as before.
- **Harder:** two collections, a migration, two packages and our own code to keep. The WebAuthn
  details stay in the library, which we track.
- **Single-maintainer risk.** `@simplewebauthn` has one npm maintainer, as did every candidate and
  `openid-client` in decision 0020. If it is abandoned or compromised:
  - the adapter is the only importer of the server package, with a small port of our own types, so
    another WebAuthn library is a rewrite of that one file, behind the same tests;
  - the stored shape is the standard one (credential ID, COSE public key, counter, transports), so
    saved passkeys survive a swap;
  - versions are pinned, `npm run audit:prod` and Dependabot watch it, and a bad release can be
    held back or the switch turned off.
- **Cost of a mistake:** a bug here could sign in the wrong account. Hence the top review level,
  tests first (replay, wrong origin, locked and agent accounts, removing another's passkey, a
  session too old) and the real-Payload and end-to-end tests (#1313, #1315, #1317).

## Links

- Epic #313 (comparison and sign-off in its comments), steps #1313 (storage, rules), #1314 (add),
  #1315 (sign in), #1316 (see and remove), #1317 (end to end), #1318 (turn on)
- Decision 0020 (Google sign-in, PR #505), 0009 (one conditional update), 0010 (retention)
- WebAuthn Level 3: https://www.w3.org/TR/webauthn-3/ (relying party ID, challenge, user
  verification, attestation)
- SimpleWebAuthn: https://simplewebauthn.dev/docs/ and https://github.com/MasterKale/SimpleWebAuthn
- Payload 3.91.0 read in `node_modules/payload`: `kv/index.d.ts`, `kv/adapters/DatabaseKVAdapter.js`,
  `auth/sessions.js`, `auth/operations/refresh.js`
