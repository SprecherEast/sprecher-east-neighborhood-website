# Security Guidelines

## Agent Security Rules (MUST follow during development)

### Before adding any new package

1. Check the package on npm — look at weekly downloads, last publish date, and maintainer count
2. Prefer packages that are widely used (>1M weekly downloads) and actively maintained (<6 months since last publish)
3. Run `npm run audit:prod` after every `npm install` — if new vulnerabilities appear, fix them before committing
4. Avoid packages with known CVEs. If a CVE exists, check if a patched version is available first
5. Prefer built-in Node.js/Next.js features over third-party packages when possible (fewer deps = smaller attack surface)

### When writing code

- Never use `eval()`, `Function()` constructor, or `dangerouslySetInnerHTML` directly — use safe shared wrappers instead (e.g., `JsonLd` component for structured data). Input that seems trusted today can become untrusted as the codebase evolves.
- Never interpolate user input into SQL, shell commands, or URLs — always use parameterized/template-safe methods
- Validate and sanitize all user input at system boundaries (API routes, form handlers)
- Use `encodeURIComponent()` when building URLs from user input
- Never log sensitive data (passwords, tokens, API keys, PII) — even in dev
- Use `overrideAccess: true` only in server-side Payload reads (never expose raw Payload queries to the client)
- Set appropriate CORS headers on API routes
- Never disable TypeScript strict checks or ESLint security rules to make code compile

### No PII in source code

- Never hardcode real email addresses, phone numbers, or personal names in source files
- Use environment variables for all email addresses (sender, recipient, reply-to)
- `.env.local.example` must use placeholder values (`you@example.com`, `no-reply@example.com`) — never real addresses
- Console logs must never include user-submitted PII (names, emails, addresses) — log only non-identifying metadata (subject, message length, timestamp)
- Sanitize user input before placing it in email headers — strip CR/LF and control characters to prevent header injection
- When validating select/dropdown values server-side, whitelist the allowed values — never trust client-submitted strings
- Seed data passwords must use `process.env.SEED_PASSWORD || crypto.randomUUID()` — never hardcode passwords like `'password'`
- All seed email addresses must use `@example.com` domain — never use real addresses

### When handling auth and sessions

- `PAYLOAD_SECRET` must be a strong random string (32+ chars) for JWT signing
- Payload handles session cookies natively via httpOnly JWT cookies
- **Sign-in length** (#587): a sign-in lasts two hours. The sign-in form's "Keep me signed in for 7 days" box, unticked by default so a shared computer stays safe, makes the token, the stored session and the cookie last 7 days (`src/modules/accounts/data/rememberedSession.ts`). It runs only after Payload accepted the password, so the lockout and the single generic failure are unchanged, and the session keeps its id, so signing out revokes it. The owner asked for it (2026-11-02, Claude chat, recorded on #587). Change the length only in `src/modules/accounts/domain/sessionLifetimes.ts`.
- Payload's built-in access control protects routes and data. Use the correct read access per collection type: `authenticatedOrPublished` for draft-enabled content (shows drafts to admins/editors, published to everyone else), `anyone` for public utility collections (Categories, Media, TeamMembers) that have no draft workflow.
- Never store tokens or secrets in localStorage — use httpOnly cookies (Payload handles this)
- Never expose user roles or permissions in client-side JavaScript beyond what's needed for UI
- **Never surface raw backend errors on auth endpoints** — login, password reset, and registration must show fixed generic messages to prevent account enumeration and information leakage. Log raw errors server-side for debugging, never render them in the UI.
- **RBAC is enforced via `src/platform/payload/roles.ts`**: All access control uses role-based functions (`isAdmin`, `isAdminOrEditor`, `isAdminOrSelf`, `isAdminFieldAccess`, `isAdminOrEditorFieldAccess`). The old `authenticated.ts` and `authenticatedSelf.ts` files are deleted — never recreate flat access checks.
- **Five roles** (#520): `admin` (full access), `editor` (content CRUD, admin panel), `guest` (read published, own profile only: has an account; the email is verified by link, but nobody has checked the home address), `resident` (a verified neighbour; same access as `guest` until residency checks exist, #314), `agent` (an automated account: reads published content and suggests events and posts through its MCP key, #336). Default for new users is `guest`; no code path creates a `resident` except an admin setting it. The owner chose the names (2026-10-31, voice session with Claude, recorded on #520): the default role is `guest`, alongside `resident` and `admin`; editor stays as it is and there is no contributor role. The first account created on an empty `users` collection is an `admin` (`firstAccountIsAdmin`, a `beforeChange` hook, #354), so a fresh install or a restore onto an empty database has someone who can open `/admin`; every later account is a `guest` and only an admin changes a role. The public sign-up never promotes: it passes `context.signUp`, which the hook skips, so only Payload's own first registration at `/admin` makes the first admin. Role checks trust only principals from `users` (`ACCOUNTS_COLLECTION`): an MCP API key can also authenticate a REST request as the key document itself, and it then counts as signed out, even where its id matches an account's.
- **Users collection access**: `admin: isAdminOrEditorBoolean`, `create/delete/unlock: isAdmin`, `read/update: isAdminOrSelf`. The role field has field-level access (`isAdminFieldAccess`) so only admins can assign roles. **Your own email changes only through the confirm-by-link flow** (#555): `requireConfirmedEmailChange` refuses a new email on the requester's own account (REST, GraphQL, `/admin`, Local API with `overrideAccess: false`) unless server code set `NEW_EMAIL_CONFIRMED` in the request context after the new address was confirmed. Payload sends a verification link only on create, so without it an update would keep the account marked verified. An admin changing another account's email is unaffected.
- **Agent access over MCP** (#336): agents reach the CMS only at `/api/mcp`, through Payload's official MCP plugin (`src/modules/agents/cms/mcp.ts`). The owner asked for it (2026-10-24, Claude Code session, recorded on #336). Each request carries an API key that acts as one `agent` account, so collection access, not just the key's checkboxes, decides what it may do: find published events, posts and categories; suggest events and posts with the `submitSuggestion` tool (always an unpublished `suggested` draft, as the agent, `overrideAccess: false`; it links existing categories only, and the draft's image is a category's default image from the site's own media, never an upload, #363); add items for editors to its run with `reportItem`, which never changes the content it points at; create, read and update its own `agent-runs`. The plugin's raw create is off for events and posts, and every tool argument has a size cap ([agent access](../architecture/agent-access.md)). It can never update, publish or delete content, nor read `users` or `form-submissions`. Every find answer is rebuilt from an allowlist (`AGENT_VIEWS` in `src/modules/agents/cms/agentViews.ts`, checked against the generated types), so no author, email or rich text reaches the model. A key stops working if its account is no longer an agent. Each connection gets 120 requests a minute, counted before the key is looked up, and each key 60 (`MCP_LIMITS`), then 429. An agent's review items are separate documents it can't change, and its run's identity can't be rewritten after the run starts. Agent accounts can't sign in with a password (`noPasswordSignInForAgents`), so the key, which an admin can delete, is their only credential. Keys are created in Admin and never written to the repo or an issue. Caddy caps `/api/mcp` request bodies at 256 KB with the form endpoints (#124).
- **Sign-up** (#187): `POST /api/users` stays admin-only. Visitors sign up only through the accounts module's server action, which calls the Local API `create` with `overrideAccess: true` and builds the data itself: the role is always `guest`, and nothing else the visitor sends reaches the account. Before creating it, the action runs the same Turnstile robot check as the contact form and checks in-memory limits (5 attempts per connection and 20 site-wide per hour, `SIGN_UP_LIMITS`). `auth.verify` is on, so a new account can't sign in until Payload's one-time link is opened, and `noResetEmailWhileUnverified` sends it no reset email until then. If the verification email fails, the action deletes the unverified account it just stored, so the address isn't stuck. Accounts an admin creates in `/admin` also start unverified and get the link. Sign-up and verification answer the same whether or not an account uses the email.
- **Forgot password** (#282): only the site's `/forgot-password` server action reaches Payload's `forgotPassword`. It runs the same guard as sign-up (`createRequestGuard`: 5 requests per connection, the Turnstile robot check, 30 site-wide per hour, `RESET_REQUEST_LIMITS`), then answers at once and runs Payload in Next's `after()`, so an existing and an unknown email take the same time. `forgotPasswordFromSiteOnly` refuses the operation over REST and GraphQL (403 for every email), and `/admin/forgot` redirects to the site's page.
- **Sign in with Google** (#188, [decision 0020](../architecture/decisions/0020-social-sign-in.md)): the owner left the library choice to us (2026-10-24, Claude Code session, recorded on #188) and later asked for established plugins or libraries rather than custom OAuth code, and for this approach not to be treated as chosen until he decides (2026-11-05, recorded on #312), so the record is Proposed. The accounts module's `/auth/google` routes use `openid-client`, which checks `state`, the `nonce`, PKCE and the ID token; the flow cookie is signed, HttpOnly, SameSite=Lax (the return from Google is a cross-site GET), cleared after one use, ten minutes, and in production `__Host-` prefixed (Secure, `Path=/`, no `Domain`) so a sibling subdomain can't plant one; its flags and Payload's auth cookie's come from one helper reading `users.auth.cookies` (`data/authCookies.ts`). Starting and finishing a sign-in are rate limited per connection only, with no site-wide cap and no robot check (a cap anyone can fill, since a script can replay a valid flow cookie for ten minutes, would switch Google off for every neighbor); a botnet can still make many per-connection-limited requests, each costing at most one call to Google. Google is on only when both its keys are set in `.env.local`. The identity is Google's subject (`googleSub`: unique, `serverOnlyFieldAccess`), never the email, and no account is linked by its email. Google is refused unless `email_verified` is true, and a new address gets a verified `guest` account, never a resident: signing in with a provider doesn't establish residency (#314). A locked, unverified or agent account is never signed in to. Every create forces `guest` (`guestOnlyFromProviders`), counts against `SIGN_UP_LIMITS`, and never sets residency. Failures show fixed messages on `/login`; the provider's text is never shown or logged: a failure logs only the error's class name.
- **Sign in with a passkey** (#1315, [decision 0021](../architecture/decisions/0021-passkey-sign-in.md)): the owner approved passkeys, the thin layer on `@simplewebauthn/server` and keeping the steps switched off until he turns them on (2026-11-19, Claude session, voice then confirmed in text, recorded on #313). Off unless `PASSKEYS_ENABLED=true` (read only in `data/passkeySettings.ts`); off, the button and routes refuse with the one fixed failure and the library isn't called. The relying party ID and the one expected origin come from the configured site address, never a request header. Passkeys are discoverable and need the device's screen lock, so the options name no account and there is no email to probe. A challenge is random, stored on the server, tied to the browser by a signed `__Host-` SameSite=Strict cookie holding only its row, and taken once by a conditional update before the answer is checked, so a replayed, expired or copied one fails. The library (through `data/webauthn.ts` only) checks signature, challenge, origin, relying party ID, screen lock and counter; the answer is also refused when the browser marks it cross-origin or its ID isn't the stored one. Then the answer's user handle must equal the credential owner's, and the owner must not be locked (#140), unverified or an agent (#336). Every refusal is one fixed message that says neither which check failed nor whether an account exists. Asking for options is limited per connection only, with no site-wide count (a cap a script can fill would switch passkey sign-in off for every neighbor) and no robot check, because a real authenticator holding a registered key is needed to answer; each request stores one challenge row that expires in five minutes and is purged hourly. Success starts Payload's own session through the code Google sign-in shares (`startSessionFor` in `data/session.ts`), honoring "Keep me signed in", so `/admin`, sign-out, lockout and `local-jwt` work as before and nothing is added to Payload. `/login` sends `frame-ancestors 'none'` as `/account` does. Email and password and forgot password are never turned off by passkeys, so losing every passkey never locks anyone out. Only an error code or fixed reason is logged, never the browser's answer, the challenge, a key or an email.
- **Robot check keys in production** (#869): the deploy's preflight stops when either Turnstile key is missing from the server's `.env.local` (`.github/scripts/robot-check-gate.sh`), because the verifier treats missing keys as "off" and logs only a line. The explicit opt-out is the repository variable `ALLOW_NO_ROBOT_CHECK=true`, which is the owner's decision alone (an agent asks him, with the `needs owner` label, and records the change on an `infra` issue first): the deploy then goes out and shows a warning on every run. Only presence is checked, not validity. Local development, the end-to-end tests and `next build` outside the deploy keep running without keys (the check is off there); `next.config.js` still refuses a build with only one key. A missing check is a second layer lost, not an open door: contact messages are held until the sender confirms their email and sign-up needs a confirmation link.
- **Site-wide limits on public account forms** (#292): sign-up and forgot password each count requests site-wide per hour, once they pass the robot check, to protect the email quota. Someone who gets that many requests past the robot check in an hour blocks the form for everyone until the hour is up; the owner accepted that trade-off (2026-10-23). The per-connection limit is counted before the robot check. Change the limits only in `src/modules/accounts/domain/requestLimits.ts`, and update this line with them.
- **Content collections** (Pages, Posts, Events, FAQ, Resources): use the shared `draftContentAccess` from `src/platform/payload/draftContentAccess.ts` (`create/update/readVersions: isAdminOrEditor`, `delete: isAdmin`, `read: authenticatedOrPublished`). Never copy its fields into a collection. Posts and Events use `suggestibleContentAccess` from the same file: the same, except that an agent may also `create`. `holdSuggestions` stores whatever a non-staff account creates as an unpublished draft with review status `suggested`, and requires its source (#123).
- **Utility collections** (Categories, Media, TeamMembers): `create/update: isAdminOrEditor`, `delete: isAdmin`, `read: anyone`. TeamMembers' `email` field is field-level `read: isAdminOrEditorFieldAccess`, so it never reaches the public API.
- **Plugin collections**: Search → `update/delete: isAdminOrEditor` (staff can reindex; the plugin's own sync bypasses access). Media folders → `isAdminOrEditor` for all ops. Redirects → `isAdmin` for all ops. Forms → `anyone` for read (visitors need the field definitions to fill a form in; with restricted read the public contact form rendered empty), `isAdminOrEditor` for create/update, `isAdmin` for delete; the `emails` field (recipients, reply-to, templates) is field-level `isAdminOrEditorFieldAccess`. Form submissions → `isAdmin` for read/update/delete, `anyone` for create (public form submissions). MCP API keys (`payload-mcp-api-keys`) → `isAdmin` for all ops, through `overrideApiKeyCollection`; a key's `user` must be an `agent` account.
- **Audit access control when adding new collections**: Every new collection must use role-based access from `src/platform/payload/roles.ts`. Never use a flat `authenticated` check.
- **Set every operation explicitly**: Payload's default for an operation you leave out is "any signed-in user". A collection must set `read`, `create`, `update` and `delete`, plus `readVersions` when it has versions and `unlock` when it has logins; a global sets `read` and `update`, plus `readVersions` with versions. Jobs set `jobs.access` (`queue`, `cancel`: staff; `run`: admins). This includes plugin and Payload collections where they can be overridden. `src/platform/payload/accessPolicy.test.ts` checks the whole config; update its policy table when access changes on purpose.
- **A field only the server sets refuses writes too** (#299): `hidden: true` hides a field from reads only, and Payload still accepts writes to it from the API. Give it `access: serverOnlyFieldAccess` from `src/platform/payload/roles.ts` (create, update and read all refused), not just `hidden: true`. The server writes it with `overrideAccess: true` or the database adapter. On a collection the public can create, a `beforeChange` hook also overwrites it on create (as `recordSenderEmail` does for `heldEmails`). `accessPolicy.test.ts` fails when a hidden field lets anyone write it, and `src/payload.config.protectedFields.test.ts` sends the writes a visitor or resident could try.
- **Custom routes check the role, not just sign-in**: a route under `src/app/` that changes data or reveals drafts (for example `/next/seed`, `/next/preview`) must check the role with the helpers in `src/platform/payload/roles.ts` and have a test that a resident is refused.
- **When changing roles or adding new roles**: Update `src/platform/payload/roles.ts`, the `role` field options in Users collection (`src/modules/accounts/cms/users.ts`), `ROLES` and the `Role` type (`src/platform/lib/roles.ts`), and generate a migration.

### Secrets management

- All secrets go in `.env.local` (gitignored, never committed)
- System-level env vars (like `HOSTINGER_API_KEY`) are set in the OS, not in files
- Never hardcode API keys, passwords, or tokens in source code
- Use `process.env.VAR_NAME` to access secrets at runtime
- Before every commit, check staged files for accidental secrets (API keys, passwords, connection strings)
- Never commit `.env.local`, SSH private keys, or any other file holding a secret. Secret scanning and push protection block most pushes that contain one, but don't rely on them

## Dependency Security Guardrails

Four layers of protection against vulnerable dependencies:

1. **Agent rules** (during development): Check packages before installing, run audit after install, fix before committing
2. **Pre-commit hook** (local): `npm run audit:prod` (below) warns if production deps have high/critical vulnerabilities
3. **CI pipeline** (PR gate): `npm run audit:prod` blocks merging if any high/critical production vulnerabilities are found; it is `npm audit --audit-level=high --omit=dev` run through `better-npm-audit`, so it also reads the written exceptions in `.nsprc`
4. **Dependabot** (ongoing): Weekly scans with grouped PRs — patches batched together, majors get individual PRs

When fixing transitive vulnerabilities:

- Use `overrides` in package.json scoped to the parent package (not global overrides)
- Dismiss unfixable alerts with a clear comment explaining why (e.g., dev-only, no upstream fix available)
- Document any overrides in PR description so reviewers understand the tradeoff
- When no fixed release exists and no override can help, the one allowed way past the gate is an entry in `.nsprc` keyed by the advisory ID (`GHSA-...`) with `notes` (what it is, why it does not reach visitors, link to the upstream fix) and an `expiry` date. `audit:prod` fails an entry without notes or expiry, or with an expiry more than 45 days out, and an entry stops applying on its expiry date, so the gate goes red again and forces a re-check. Aim for about 30 days. Each entry has an open issue that says how to remove it. A new entry, or a later expiry on an existing one, needs the owner's decision recorded on that issue. `.nsprc` is the only exceptions file: `audit:prod` fails if `.nsprc.js` or `.nsprc.cjs` exists, because better-npm-audit reads those first and they could compute an expiry at run time. Never lower the level, skip the job or list a whole module

## Infrastructure Security

- SSH key-based auth only on VPS (no password auth)
- Caddy handles SSL/TLS automatically when domain is configured
- PM2 runs the app as a managed process (auto-restart on crash)
- The VPS credentials are secrets of the GitHub environment `production`, which only runs from `main` (never in code; [where they live](../../ops/README.md#where-the-deploy-secrets-live))
- **NEVER overwrite `/etc/caddy/Caddyfile`** — always read it first, then ADD new server blocks. The automated exceptions run by every deploy, each refusing any edit that changes more than its own: `ops/caddy-limits.sh` adds an `import` line inside the site blocks that proxy to the app (#124); `ops/caddy-https.sh` adds an HSTS `import` line to the domain's HTTPS block and a `redir` line to the site blocks that serve plain HTTP (#235); `ops/caddy-previews.sh` adds one top-level `import` line for the folder of pull request preview site blocks (#1072); `ops/install-umami.sh` adds one top-level `import` line for Umami's own site block, only after Umami's default admin password is replaced, and each deploy makes the route file it points at a closed 503 block (Caddy reloaded) unless both the Umami and database containers are running (#948)
- Always back up before editing: `cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak`
- Always validate before reloading: `caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`
- Live domains (`sprechereast.com`, `www.sprechereast.com`) must NEVER be removed from the Caddyfile
- `ops/preview-caddy.sh` writes only files in the previews folder (`/etc/caddy/previews/`), never the Caddyfile (#1345)

## Pull request previews

A pull request preview (#1070) runs code nobody has reviewed yet, beside production. It starts with
no real secret or service key of its own, and it deploys and runs under one restricted account, not
production's ([`ops/previews.md`](../../ops/previews.md)). The isolation check that proves it can't
reach production's files, and the protection of Caddy's admin endpoint, are still to come (#1346); until
then the account's separation rests on file permissions alone. What holds now:

- **Its own secrets, no real keys** (#1344): `ops/preview-settings.sh` writes each preview's
  `.env.local` (mode 600) with `PAYLOAD_SECRET` and `PREVIEW_SECRET` made at random on the server,
  Cloudflare's published Turnstile test keys, no `SMTP_HOST` (email is logged, never sent), and no
  analytics ID, GitHub token or outside sign-in key. Production's settings are never read or copied,
  and a production sign-in token is worth nothing on a preview. A preview's sign-in cookie sets no
  `Domain`, so production's is never sent to it. The owner decided this (2026-11-11, recorded on
  #1074).
- **Never printed:** the deploy log is public, so no generated secret appears in it.
- **No basic auth on previews:** they hold only code already public in this repository and content
  already published, and a password would block opening the link on a phone and AI agents taking
  screenshots. Noindex headers and a disallow-all `robots.txt` are required instead
  ([`ops/previews.md`](../../ops/previews.md)).

- **One restricted account** (#1345): the previews' folders, PM2 state and apps belong to one Unix
  account with no password and no other group, whose home, `.ssh` and `authorized_keys` are root-owned,
  so a preview can't add a key or replace the forced command. Its key line is `restrict` plus a forced
  command: a root-owned wrapper, installed from `main` by the production deploy only
  (`ops/install-preview-access.sh`; a preview deploy never writes it), that runs only `facts`, `list`,
  `upload`, `deploy` and `teardown`. Every request word is checked against a fixed pattern (a number of up
  to six digits, a 40-digit lowercase hex commit) before it reaches a path or a command, nothing is
  passed to a shell, and a refusal never repeats the request, because the deploy log is public. An
  uploaded release may hold no path or link that leaves it. The deploy runs `main`'s copy of the deploy
  scripts on the release, never the release's own.
- **Caddy is changed only by a root script the account reaches through one sudo rule** (#1345):
  `ops/preview-caddy.sh` takes one pull request number (the rule matches 1 to 6 digits, and the script
  checks again, and refuses an environment that tries to redirect it), builds the block from `main`'s
  copies of the two templates, has Caddy validate it before it enters the previews folder, moves it in
  atomically, validates the whole config, reloads, and puts the previous block back on any failure. It
  never reads a file from a preview.
- **The installer changes nothing on doubt** (#1345): a different account of that name, a link or foreign
  owner on a path it uses, a file it did not write, an sshd that would not take the key line, or a tool the
  account can't run stops it with a warning. It backs up every file it replaces, checks as the account that
  the wrapper works, refuses anything else and that the account can't write its home, and writes the key
  line last. The key's public half is committed (`ops/preview-deploy-key.pub`); its private half is the only
  secret of the GitHub environment `preview`, and no preview or teardown job names `production`. The owner
  decided the account, the wrapper and the environment (2026-11-11, recorded on #1074); one account instead
  of a separate runtime user is recorded on #1345 (2026-11-20).

This section grows with the isolation check and the Caddy admin protection (#1346).

## Agents and the rules that bind them

- **Agents never change their own guardrails.** `AGENTS.md`, the tool adapters, `.agents/`,
  `.github/`, `docs/guidelines/`, `docs/roles/` and `docs/process/` set the rules. A change to any of
  them is a pull request the owner decides, and the independent review lists it as a policy change
  ([`AGENTS.md`](../../AGENTS.md), step 3). Wording, link and fact fixes under `docs/process/`
  are not policy changes. `.github/CODEOWNERS` maps these paths to the owner.
- **Code-owner review is not required yet** (#694). The `main` ruleset needs a pull request and the
  checks but no approvals, and agents open pull requests through the owner's own account; GitHub
  doesn't let an author approve their own pull request, so requiring a code owner's approval would
  block every pull request that touches a protected path. It becomes possible when agents have
  their own identity (#106). Until then the rule rests on this file, `AGENTS.md` and the review.
- An agent that coordinates other agents (the chief of staff) may not edit code, push or merge;
  workers still merge their own reviewed pull requests (#695).

## GitHub Security Features (Active)

- Secret scanning: detects leaked credentials in commits
- Push protection: blocks pushes containing secrets
- Dependabot alerts: flags vulnerable dependencies
- Dependabot security updates: auto-PRs for vulnerable deps
- Dependabot grouping: patches and minors batched to reduce PR noise
- CodeQL: semantic code analysis on every PR
- Dependency audit: CI blocks PRs with high/critical npm vulnerabilities

Fix CodeQL findings before merging, and review Dependabot PRs promptly.
