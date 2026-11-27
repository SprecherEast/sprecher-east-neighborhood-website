# 0023: OAuth sign-in for MCP clients on `@node-oauth/oauth2-server` and our own thin layer

- **Date:** 2026-11-26
- **Status:** Proposed. It becomes Accepted when a real connection from Claude works end to end (#1500, after the Caddy path-through #1508): unit tests alone missed that the first review's browser case failed, so a fixed head's review is not enough.
- **Issues and PRs:** #1501, under the epic #1498; #1508 (Caddy path-through).

## Context

Claude's custom connectors, and other AI tools, sign in to an MCP address with OAuth: authorization
code with PKCE, discovery by a `401`, the resource indicator. The site's `/api/mcp` took only an
API key, which those connectors do not send. Summary of the owner's direction (2026-11-26, voice
session with Claude Code, recorded on #1501): use the established `@node-oauth/oauth2-server` for
the security-critical parts, with a thin layer of our own connecting it to Payload sign-in and the
MCP; not the young single-maintainer plugin; sign-in reuses the existing Payload account and the
MCP's existing access rules.

**What must not change:** the API-key path (Local Scout), `noPasswordSignInForAgents`, the agent
role's access, and how an account signs in (the checks, the cookie, Google, passkeys). Nothing here
lets an agent publish (#1502).

**What changed in the accounts module (a scope change, decided by the chief of staff on 2026-11-27,
recorded on #1501):** a visitor who must log in before approving a connection has to come back to
that same request, so the log in page and its two forms (`SignInForm`, `PasskeySignIn`) accept a
return path (`?next=`), checked by `safeReturnPath` against an allow list of one path, never another
address; the other accounts files touched only use the new shared `ButtonRow`. Signing in itself is
unchanged.

## What we considered

Checked on 2026-11-26 from the npm registry, each project's repository and its advisories.

- **Native and official:** Payload's MCP plugin has Bearer API keys and the `overrideAuth` seam only;
  Payload's auth has no OAuth server. No `@payloadcms/*` package does it. `overrideAuth` is the seam used.
- **`@brainwebuk/payload-plugin-mcp-oauth`:** does this job, but is first published in 2026-05, one
  maintainer, pre-1.0, patches the plugin's options in place and offers open registration. Not chosen
  (the owner's direction).
- **`@node-oauth/oauth2-server` 5.3.1 (chosen):** MIT, the maintained continuation of the
  `oauth2-server` line, about 340,000 downloads a week, three small dependencies, no install scripts,
  CodeQL and a security policy. One published advisory, CVE-2026-41213 (PKCE verifier format, and a
  failed verifier not spending the code), fixed in 5.3.0. Two tests pin that fix here.
- **`oidc-provider`:** complete, but Koa-based and heavy to mount in Next.js route handlers.
- **`better-auth`:** brings a second user and session system beside Payload's accounts.

## Decision

1. The OAuth library runs the protocol (codes, PKCE, refresh, error codes) with the strictest options:
   PKCE required, S256 only, a state required, refresh tokens replaced on every use.
2. Our layer in `src/modules/agents/`: the rules in `domain/oauth/` (pure, tested), storage in
   `data/oauth/` (its model, two admin-only collections), the consent page and token address in
   `use-cases/oauth/`, the MCP check in `cms/oauth/`. Cryptography is Node's `crypto` (random bytes,
   HMAC-SHA256), no hand-written primitive.
3. Clients are registered by hand by an admin and bound to one agent account; every client is public
   (no secret). No registration endpoint. Client ID metadata documents and dynamic registration are
   left out until a tool needs them.
4. Credentials are stored as HMACs with the site secret. The audience (`resource`) is the MCP address,
   checked at the authorization, stored with the token and checked on every call.
5. Replay of a code or refresh token revokes the family; spending is one conditional `UPDATE`, and so is the revocation. Saving a request's tokens checks the family before and after and undoes what it saved if the family has ended, and every use checks it again, so two requests at once leave nothing usable.
6. Discovery documents are at `/.well-known/` through `next.config.js` rewrites; the `401` carries
   `WWW-Authenticate` through Payload's `req.responseHeaders`.
7. Only an admin sees the approval; a signed ticket binds it to that admin and request.
8. Two pages, because of the browser: the tool sends the admin's browser from its own site, where Payload's CSRF check (kept as it is) ignores the session cookie, so `/oauth/authorize` reads no session and shows no account, and its link to `/oauth/approve` is opened from this site, where the session is read (Payload reads it on a same-origin or same-site request). Both pages send `frame-ancestors 'none'`, `/oauth/approve` included, so a page on a sibling subdomain cannot frame the approval. The link carries the checked request and no secret; it is read again from scratch. A visitor is sent to log in and back to the same request, only to that path.

## Consequences

- Claude and other tools can connect without a key the owner would have to paste; he registers the
  client once and presses Allow once, and the tool renews in the background.
- One more dependency (four packages with its own). A later security advisory means an update.
- Expired token rows stay until a cleanup job exists. After Google sign-in (which lands on the
  account page) the admin starts again from the tool. Per-client scopes are #1499.
- Caddy must pass `/.well-known/` to the site (#1508).

## Links

#1501, #1498, #1499, #1502, #1508; MCP authorization specification; RFC 6749, 7636, 8252, 8414,
8707, 9207, 9728; Claude "Authentication for connectors".
