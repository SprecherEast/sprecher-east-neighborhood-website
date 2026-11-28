/**
 * The named scopes of the AI agent address (#1499): what a connected AI tool, signed in with
 * OAuth or a key, may reach. Pure rules, applied by `cms/scopes.ts`. A scope only narrows: the
 * result is always the overlap of what the scopes grant and what the key's own boxes or the
 * address's options offer, and the agent account's collection access decides the rest.
 */

/** The scopes an admin can give a client. `suggest` includes the client's own run log, because both of its tools attach to a run. */
export const SCOPES = ['read', 'suggest'] as const
export type Scope = (typeof SCOPES)[number]

/**
 * Named for the gated publish rule of #1502 and granting nothing here: it cannot be given to a
 * client, and no mapping below produces a write to events, posts or categories.
 */
export const RESERVED_SCOPES = ['publish'] as const

/** What each scope lets an AI agent do, in the words an admin reads in Admin and on the approval page. */
export const SCOPE_LABELS: Record<Scope, string> = {
  read: 'Read published events, posts and categories',
  suggest: 'Suggest drafts and items for us to review, and keep its own run log',
}

/** The set a client gets when it asks for none, and the default of a new client's record. */
export const MINIMAL_SCOPES: readonly Scope[] = ['read']

type Op = 'find' | 'create' | 'update' | 'delete'
const OPS: readonly Op[] = ['find', 'create', 'update', 'delete']

/** Per scope: the plugin's collection boxes (camel-cased slugs) and its custom tools. */
const GRANTS: Record<
  Scope,
  { collections: Record<string, readonly Op[]>; tools: readonly string[] }
> = {
  read: {
    collections: { events: ['find'], posts: ['find'], categories: ['find'] },
    tools: [],
  },
  suggest: {
    collections: { agentRuns: ['find', 'create', 'update'] },
    tools: ['submitSuggestion', 'reportItem'],
  },
}

const COLLECTIONS = [...new Set(Object.values(GRANTS).flatMap((g) => Object.keys(g.collections)))]
const TOOLS = [...new Set(Object.values(GRANTS).flatMap((g) => g.tools))]
export const TOOL_ACCESS_KEY = 'payload-mcp-tool'

/** The plugin's name for a collection's tool: `find` and `agentRuns` make `findAgentRuns`. */
const collectionToolName = (op: Op, key: string) =>
  `${op}${key.charAt(0).toUpperCase()}${key.slice(1)}`

const isScope = (value: string): value is Scope => (SCOPES as readonly string[]).includes(value)
const isKnown = (value: string) =>
  isScope(value) || (RESERVED_SCOPES as readonly string[]).includes(value)
const inOrder = (values: readonly string[]) =>
  [...SCOPES, ...RESERVED_SCOPES].filter((s) => values.includes(s))

/** The access boxes as the plugin reads them: a collection's operations, and the custom tools. */
export type Access = Record<string, Record<string, boolean>>

const ticked = (box: unknown, name: string): boolean =>
  typeof box === 'object' && box !== null && (box as Record<string, unknown>)[name] === true

/**
 * What a client may do: every box the ceiling ticks that one of the scopes grants, and nothing
 * else, with each box written out so no leftover setting decides anything. A scope this file does
 * not know grants nothing.
 */
export function narrowAccess(ceiling: Record<string, unknown>, scopes: readonly string[]): Access {
  const held = SCOPES.filter((scope) => scopes.includes(scope))
  const access: Access = {}
  for (const key of COLLECTIONS) {
    access[key] = Object.fromEntries(
      OPS.map((op) => [
        op,
        ticked(ceiling[key], op) && held.some((s) => GRANTS[s].collections[key]?.includes(op)),
      ]),
    )
  }
  access[TOOL_ACCESS_KEY] = Object.fromEntries(
    TOOLS.map((tool) => [
      tool,
      ticked(ceiling[TOOL_ACCESS_KEY], tool) && held.some((s) => GRANTS[s].tools.includes(tool)),
    ]),
  )
  return access
}

/** The scope a tool belongs to, or null for a tool no scope offers. */
export function requiredScope(toolName: string): Scope | null {
  for (const scope of SCOPES) {
    const { collections, tools } = GRANTS[scope]
    if (tools.includes(toolName)) return scope
    for (const [key, ops] of Object.entries(collections)) {
      if (ops.some((op) => collectionToolName(op, key) === toolName)) return scope
    }
  }
  return null
}

/** The scope a call needs that the client lacks (the first one), or null when it may go ahead. */
export function firstMissingScope(
  toolNames: readonly string[],
  held: readonly string[],
): Scope | null {
  for (const name of toolNames) {
    const needed = requiredScope(name)
    if (needed && !held.includes(needed)) return needed
  }
  return null
}

/** The scopes a client asks for, in order and once each; a name that is not ours refuses the request. */
export function parseRequestedScopes(
  raw: string | undefined,
): { ok: true; scopes: string[] } | { ok: false } {
  const asked = scopeList(raw)
  if (asked.length === 0) return { ok: true, scopes: [...MINIMAL_SCOPES] }
  return asked.every(isKnown) ? { ok: true, scopes: inOrder(asked) } : { ok: false }
}

/** The names in a space-separated scope value (RFC 6749 section 3.3), as stored and as sent. */
export const scopeList = (value: string | null | undefined): string[] =>
  (value ?? '').split(' ').filter(Boolean)

/** What is granted: what was asked, if the client's record allows it. Never more than the record. */
export function grantFor(requested: readonly string[], allowed: readonly string[]): Scope[] {
  return SCOPES.filter((scope) => requested.includes(scope) && allowed.includes(scope))
}

/**
 * Whether the record covers every scope a request names, so it can be granted as it stands: the
 * library's scope check, and the approval checked again in case the record was narrowed since.
 */
export const recordAllows = (requested: readonly string[], allowed: readonly string[]): boolean =>
  requested.length > 0 && grantFor(requested, allowed).length === requested.length

/** What a token may do right now: only what its client's record still allows and the token was given. */
export const effectiveScopes = (record: readonly string[], token: readonly string[]): Scope[] =>
  grantFor(token, record)

/** Used scopes of a stored value: only names that are scopes, whatever else a record holds. */
export const scopesOf = (value: unknown): Scope[] =>
  Array.isArray(value) ? SCOPES.filter((scope) => value.includes(scope)) : []

/** The tools a JSON-RPC body calls (one request or a batch), so a call out of scope can be named. */
export function toolCallNames(body: unknown): string[] {
  const requests = Array.isArray(body) ? body : [body]
  return requests.flatMap((request) => {
    if (typeof request !== 'object' || request === null) return []
    const { method, params } = request as { method?: unknown; params?: { name?: unknown } }
    return method === 'tools/call' && typeof params?.name === 'string' ? [params.name] : []
  })
}

/** Whether an expiry has come. A date that cannot be read counts as past, never as no expiry. */
export function isExpired(expiresAt: Date | string | null | undefined, now: Date): boolean {
  if (expiresAt === null || expiresAt === undefined || expiresAt === '') return false
  const time = new Date(expiresAt).getTime()
  return Number.isNaN(time) || time <= now.getTime()
}
