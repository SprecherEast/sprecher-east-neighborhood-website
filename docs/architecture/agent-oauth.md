# Agent OAuth

How an AI tool such as Claude signs in to the AI agent address (`/api/mcp`, #1501) with OAuth, and
what stops it going wrong. [Agent access](agent-access.md) says what an agent may do once in; the
[decision record](decisions/0023-mcp-oauth-sign-in.md) says why it is built this way. The flow is
the MCP authorization specification's: authorization code with PKCE, discovery by a 401, the
resource indicator.

## The flow

1. An admin creates the agent account (role `agent`) and registers the tool in Admin, under Agents,
   **OAuth clients**: a name, the agent account, and its redirect addresses. Saving makes the client
   ID. The tool is given the ID and no secret (every client is public; PKCE protects the code).
2. The tool calls `/api/mcp` with no token. It gets `401` and `WWW-Authenticate: Bearer
resource_metadata="https://<site>/.well-known/oauth-protected-resource/api/mcp"`.
3. It reads that document (`resource` is the MCP address; `authorization_servers` is this site), then
   `/.well-known/oauth-authorization-server` (RFC 8414): the two addresses below, `S256` as the only
   method, no registration address. Both are served by routes under `/oauth/discovery/`, reached
   through the rewrites in `next.config.js`. A document answers only for the resource whose path it is fetched with (RFC 9728), so only `/.well-known/oauth-protected-resource/api/mcp` is served; it and the authorization-server document say the redirect carries `iss` (RFC 9207).
4. It sends the admin's browser to `/oauth/authorize` with the client ID, redirect address, PKCE
   challenge, state and `resource`. This visit comes from the tool's own site, so the browser holds
   back the session cookie (Payload's CSRF check ignores it on a cross-site visit, and we keep
   that). The page therefore reads no session and shows no account: it checks the request (below),
   says who is asking and where it returns to, and offers **Continue to approval**.
   That link goes to `/oauth/approve` on this site, carrying the checked request and nothing
   secret, so the browser sends the session and the page checks everything again. There a signed-in
   admin is asked to **Allow this connection**, with the tool's name, the host it returns to and the
   agent account. A visitor is told to log in with an admin account and is sent back to the same
   request after logging in (`/login?next=`, which only returns to `/oauth/approve`). An editor is
   told an admin is needed. Google sign-in lands on the account page, so after it the admin starts
   again from the tool. Each visit to either page counts against 30 a minute per connection.
5. Allow makes a code bound to the challenge, the redirect address and the resource, and sends the
   browser back to the tool. The tool posts the code and the PKCE verifier to `/oauth/token`.
6. It receives an access token (an hour) and a refresh token (30 days, replaced on each use), and
   calls `/api/mcp` with `Authorization: Bearer <access token>`.

What the owner does at connect time: register the client, give the tool its ID and the two addresses
(or just the MCP address, so it finds them), log in as an admin, and press **Allow this connection**.

## Where things are

| Part                                              | File                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Rules: redirect addresses, audience, token checks | `domain/oauth/redirectUri.ts`, `resource.ts`, `tokens.ts`, `queries.ts`              |
| The request, the ticket, the documents            | `domain/oauth/authorizeRequest.ts`, `consent.ts`, `metadata.ts`                      |
| Hashing and generating credentials                | `domain/oauth/secrets.ts` (Node `crypto`: random bytes and HMAC-SHA256)              |
| Storage the OAuth library asks for                | `data/oauth/model.ts`, `credentials.ts`, `clients.ts`                                |
| The two pages, approval and token address         | `use-cases/oauth/*.ts`, `actions.ts`, `ui/Co*.tsx`, `src/app/(frontend)/oauth/`      |
| Collections and the MCP check                     | `cms/oauth/oauthClients.ts`, `oauthTokens.ts`, `authenticateBearer.ts`, `cms/mcp.ts` |

`@node-oauth/oauth2-server` 5.3.1 does the protocol: it validates the code, the PKCE verifier (S256
only, 43 to 128 characters), the redirect address, the state and the client, spends the code before
it checks the verifier, and builds the error and token answers. We supply storage, the checks it
leaves to a model, and everything it does not do: discovery, the resource, consent, audience
checks on every call.

## Threat model

| Threat                                    | What stops it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A code sent to an attacker's address**  | Clients are registered by hand with their redirect addresses. A request's address must equal one of them as text; no wildcard, no prefix, no case change, no other scheme. Only an `http` loopback address may vary its port (RFC 8252), written one plain way, with no fragment or username. An unmatched address is shown on the site and nothing is redirected: an error sent to an unchecked address would be the attack. Errors reach the tool only after the address is trusted.                                                                                                    |
| **Open redirect through errors**          | See above; `redirectBack` builds the URL from the registered address and sets only `code`, `state`, `error`, `error_description` and `iss`.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **A token leaking**                       | Stored only as an HMAC with the site secret, so a copy of the database proves nothing; shown once to the tool; the hash column is readable by no one through the API. The token address sets `Cache-Control: no-store`. Tokens are accepted only in the `Authorization` header, never a query. Nothing logged holds a token: an unexpected error answers a fixed `server_error`. The consent page's address (it holds the state and challenge, not a token) is `no-referrer` and `noindex`. An access token lasts an hour.                                                                |
| **A stolen code**                         | PKCE S256 binds the code to a secret only the tool holds. A code lasts two minutes, is spent by the first try (a wrong verifier included, so it cannot be guessed at), and cannot be used twice; a second use revokes what the first made.                                                                                                                                                                                                                                                                                                                                                |
| **Replay of a refresh token**             | Each use spends it atomically (one conditional `UPDATE`) and issues a new one. A spent one used again, or two at the same moment, ends the whole family: every code, access token and refresh token from that approval. The revocation is one `UPDATE`; saving a request's new tokens checks the family before and after, and if it has ended refuses the request and revokes what it saved, so the request that got in first is cut off too; and every use (`getRefreshToken`, the MCP check) looks for a revoked row in the family again. The same holds for two exchanges of one code. |
| **CSRF on consent**                       | Only an admin's session reaches the approval, which is read only on a request from our own site, and the buttons are server actions, which Next.js only runs for the site's own origin. Each carries a ticket: an HMAC over the admin's account, the whole request and an expiry (ten minutes), so a forged or changed request, another admin's ticket or an old one is refused. The client and address are checked again. The page sends `frame-ancestors 'none'`, so it cannot be framed and clicked.                                                                                   |
| **A token for the wrong service**         | The request must carry `resource` equal to the MCP address, the token stores it, and every `/api/mcp` call checks it again (RFC 8707, MCP spec). A token for another address, or issued before the site's address changed, is refused.                                                                                                                                                                                                                                                                                                                                                    |
| **An agent gaining more than an API key** | A token acts as the client's agent account, with the same tools an API key with every box ticked has. The account must still be an agent at every call. No client can act as staff: the client's account is filtered to the agent role on save. Nothing here publishes (#1502).                                                                                                                                                                                                                                                                                                           |
| **Guessing at the token address**         | 30 requests a minute per connection, only two grants, fixed error names, a body read no further than 8 KB as it arrives (and Caddy's 256 KB cap, #1508).                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Someone registering themselves**        | No registration endpoint, and the collections are admin-only in every operation; token rows cannot be created or edited through the API except to revoke, and a revoked row cannot be un-revoked or its date moved.                                                                                                                                                                                                                                                                                                                                                                       |

## Revoking

Set **Revoked at** on any row of **OAuth tokens** (its family goes with it); switch the client off
(its tokens stop at the next call and no refresh works); delete the client (its tokens are deleted);
or change the account's role (the next call is refused). Moving a client to another agent account revokes all its tokens at once, and a token is also refused when its account is not the client's. A revoked row stays revoked: the date cannot be cleared or moved.

## Not covered yet

Per-client scopes (#1499), publishing by an agent (#1502), client ID metadata documents and dynamic
registration, a return address after Google sign-in, a limit shared across more than one server process, deleting old token rows, and the Caddy path-through
for `/.well-known/` (#1508).
