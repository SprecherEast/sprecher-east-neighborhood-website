import { REST_POST } from '@payloadcms/next/routes'
import type { Payload, SanitizedConfig, TypedUser } from 'payload'

/**
 * Sends MCP JSON-RPC requests to Payload's `/api/mcp` with an API key or an OAuth access token (or
 * none, with `null`), as an agent runtime does,
 * through the same REST handler the site's `/api` route uses (#336).
 */
export function mcpClient(config: SanitizedConfig) {
  let requestId = 0

  async function call(method: string, params: Record<string, unknown>, key: string | null) {
    const request = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        ...(key === null ? {} : { Authorization: `Bearer ${key}` }),
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
    })
    const response = await REST_POST(Promise.resolve(config))(request, {
      params: Promise.resolve({ slug: ['mcp'] }),
    })
    const raw = await response.text()
    // Streamable HTTP may answer as one server-sent event
    const json = raw.startsWith('event:') ? raw.slice(raw.indexOf('data:') + 5) : raw
    return {
      status: response.status,
      headers: response.headers,
      body: raw ? JSON.parse(json) : null,
    }
  }

  /** Calls a tool and answers the text it returned, and whether the server marked it an error. */
  async function tool(name: string, args: Record<string, unknown>, key: string) {
    const { body } = await call('tools/call', { name, arguments: args }, key)
    const result = body?.result
    const text = String(result?.content?.[0]?.text ?? JSON.stringify(body))
    return { text, isError: Boolean(result?.isError ?? body?.error) }
  }

  return { call, tool }
}

/** Every tool the plugin offers, checked on a key, so only collection access can refuse. */
const ALL_TOOLS = {
  events: { find: true },
  posts: { find: true },
  categories: { find: true },
  agentRuns: { find: true, create: true, update: true },
}

/** An MCP API key for `owner`, created by `admin` in Admin. */
export const createMcpKey = (payload: Payload, admin: TypedUser, owner: number, apiKey: string) =>
  payload.create({
    collection: 'payload-mcp-api-keys',
    data: { user: owner, label: 'Test', enableAPIKey: true, apiKey, ...ALL_TOOLS },
    user: admin,
    overrideAccess: false,
  })
