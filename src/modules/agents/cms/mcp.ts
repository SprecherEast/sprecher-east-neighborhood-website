import type { MCPAccessSettings, MCPPluginConfig } from '@payloadcms/plugin-mcp'
import { APIError, type PayloadRequest, UnauthorizedError } from 'payload'

import { parseClientIp, SlidingWindowCounter } from '@/platform/lib'
import { getServerSideURL } from '@/platform/lib/getURL'
import { hasAgent } from '@/platform/payload/roles'

import { toAgentAnswer } from '../domain/agentView'
import { MCP_LIMITS } from '../domain/mcpLimits'
import { bearerChallenge } from '../domain/oauth/metadata'
import { mcpResource } from '../domain/oauth/resource'
import { tokenKindOf } from '../domain/oauth/secrets'
import { AGENT_RUNS } from './agentRuns'
import { AGENT_VIEWS } from './agentViews'
import { adminOnlyApiKeys } from './apiKeys'
import { authenticateOAuth } from './oauth/authenticateBearer'
import { reportItemTool } from './tools/reportItem'
import { submitSuggestionTool } from './tools/submitSuggestion'

type Answer = { content: Array<{ text: string; type: string }> }

/** Every MCP answer is rebuilt from the allowlisted view, so no personal data reaches the model. */
const answerFor =
  (collection: string) =>
  (response: Answer, doc: Record<string, unknown>): Answer => {
    const heading = response.content[0]?.text.split('\n')[0] ?? ''
    const text = toAgentAnswer(AGENT_VIEWS, collection, heading, doc)
    return text === null ? response : { content: [{ type: 'text', text }] }
  }

// In memory: the site runs as one PM2 process
const requests = new SlidingWindowCounter(MCP_LIMITS.windowMs, MCP_LIMITS.trackedKeys)
const connections = new SlidingWindowCounter(MCP_LIMITS.windowMs, MCP_LIMITS.trackedConnections)

const tooMany = () => new APIError('Too many requests. Try again in a minute.', 429, null, true)

const bearerToken = (req: PayloadRequest): string | null => {
  const header = req.headers.get('Authorization')
  return header && /^bearer /i.test(header) ? header.slice(7).trim() : null
}

/**
 * A 401 from this address says where to sign in (RFC 9728): the `WWW-Authenticate` header points
 * at the protected-resource metadata, so an MCP client such as Claude can find the OAuth flow.
 * Payload adds `req.responseHeaders` to the error answer.
 */
const challenge = (req: PayloadRequest) => {
  const headers = new Headers(req.responseHeaders)
  headers.set('WWW-Authenticate', bearerChallenge(getServerSideURL()))
  req.responseHeaders = headers
}

/**
 * A per-connection limit counted before the credential is looked up, so guessing keys is slow;
 * then the credential, either one of our OAuth access tokens (#1501, recognised by its prefix,
 * which no API key has) or the plugin's own key check, which is unchanged; and two of ours: the
 * account must still be an agent (a credential never acts as staff, even if the account's role
 * changed), and each key or client gets a few requests a minute. Past a limit, 429; with no
 * valid credential, 401 pointing at the OAuth metadata.
 */
const checkAgentKey = async (
  req: PayloadRequest,
  defaultSettings: (apiKey?: null | string) => Promise<MCPAccessSettings>,
): Promise<MCPAccessSettings> => {
  const now = Date.now()
  const ip = parseClientIp(req.headers)
  if (ip && !connections.tryTake(ip, MCP_LIMITS.perConnection, now)) throw tooMany()
  try {
    const token = bearerToken(req)
    const settings =
      token !== null && tokenKindOf(token) === 'access'
        ? await authenticateOAuth(req, token, mcpResource(getServerSideURL()), mcpOptions)
        : await defaultSettings()
    if (!hasAgent(settings.user)) throw new UnauthorizedError()
    if (!requests.tryTake(String(settings.id), MCP_LIMITS.perKey, now)) throw tooMany()
    return settings
  } catch (error) {
    if (error instanceof UnauthorizedError) challenge(req)
    throw error
  }
}

/**
 * Agent access through Payload's official MCP plugin at `/api/mcp` (#336). Each request carries
 * an API key, or an OAuth access token (#1501), that acts as an agent account, so collection access decides what it may do: find
 * published events, posts and categories, suggest drafts and report items with its two tools,
 * and keep its own run history.
 * The per-key checkboxes in Admin can only narrow that.
 */
export const mcpOptions: MCPPluginConfig = {
  collections: {
    // Agents suggest through `submitSuggestion`, not the plugin's raw create
    events: {
      enabled: { find: true },
      description: 'Published neighborhood events. Suggest new ones with submitSuggestion.',
      overrideResponse: answerFor('events'),
    },
    posts: {
      enabled: { find: true },
      description: 'Published neighborhood news posts. Suggest new ones with submitSuggestion.',
      overrideResponse: answerFor('posts'),
    },
    categories: {
      enabled: { find: true },
      description:
        'Categories shared by events and posts (parent = the broader category), to file a suggestion under.',
      overrideResponse: answerFor('categories'),
    },
    [AGENT_RUNS]: {
      enabled: { find: true, create: true, update: true },
      description:
        'Your run history: create one run per run (its runId goes to submitSuggestion and ' +
        'reportItem), update it as you go, and find your last runs to resume from their ' +
        'source cursors. You see only your own runs.',
      overrideResponse: answerFor(AGENT_RUNS),
    },
  },
  overrideApiKeyCollection: adminOnlyApiKeys,
  overrideAuth: checkAgentKey,
  mcp: {
    tools: [submitSuggestionTool, reportItemTool],
    serverOptions: {
      serverInfo: { name: 'Sprecher East', version: '1.0.0' },
      instructions:
        'Sprecher East neighborhood website (Madison, WI). Read published events and posts, and ' +
        'suggest new ones for staff to review. Nothing you create is published.',
    },
  },
}
