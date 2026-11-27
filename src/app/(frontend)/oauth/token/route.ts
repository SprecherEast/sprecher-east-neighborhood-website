import { FORM_CONTENT_TYPE, tokenError, type TokenAnswer } from '@/modules/agents'
import { exchangeToken } from '@/modules/agents/server'
import { readLimitedBody } from '@/platform/lib/readLimitedBody'

// A token request is a few short fields; anything bigger is not one
const MAX_BODY_BYTES = 8 * 1024

const respond = ({ status, headers, body }: TokenAnswer) => Response.json(body, { status, headers })

const invalidRequest = (description: string) =>
  respond(tokenError(400, 'invalid_request', description))

/**
 * The OAuth token address (#1501): `POST application/x-www-form-urlencoded`, as RFC 6749
 * requires. The form is read here into plain strings and the rest is the agents module's. No
 * CORS headers: the AI tools call it from their servers, and a web page has no business here.
 */
export async function POST(request: Request): Promise<Response> {
  const type = request.headers.get('content-type') ?? ''
  const length = Number(request.headers.get('content-length') ?? 0)
  if (!type.toLowerCase().startsWith(FORM_CONTENT_TYPE) || length > MAX_BODY_BYTES) {
    return invalidRequest(`Send a form (${FORM_CONTENT_TYPE}).`)
  }
  // Counted as it arrives: a request that states no length is cut off, not read in full first
  const text = await readLimitedBody(request, MAX_BODY_BYTES)
  if (text === null) {
    return invalidRequest('The request is too big.')
  }
  // No prototype, so a field named like an object member (`constructor`) is not already there
  const form: Record<string, string | string[]> = Object.create(null)
  for (const [name, value] of new URLSearchParams(text)) {
    const earlier = form[name]
    form[name] = earlier === undefined ? value : [...[earlier].flat(), value]
  }
  return respond(await exchangeToken(form, request.headers))
}
