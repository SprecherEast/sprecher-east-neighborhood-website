import { exchangeToken } from '@/modules/agents/server'

const FORM = 'application/x-www-form-urlencoded'
// A token request is a few short fields; anything bigger is not one
const MAX_BODY_BYTES = 8 * 1024

const answer = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache', ...headers },
  })

/**
 * The OAuth token address (#1501): `POST application/x-www-form-urlencoded`, as RFC 6749
 * requires. The form is read here into plain strings and the rest is the agents module's. No
 * CORS headers: the AI tools call it from their servers, and a web page has no business here.
 */
export async function POST(request: Request): Promise<Response> {
  const type = request.headers.get('content-type') ?? ''
  const length = Number(request.headers.get('content-length') ?? 0)
  if (!type.toLowerCase().startsWith(FORM) || length > MAX_BODY_BYTES) {
    return answer(400, { error: 'invalid_request', error_description: `Send a form (${FORM}).` })
  }
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) {
    return answer(400, { error: 'invalid_request', error_description: 'The request is too big.' })
  }
  const form: Record<string, string | string[]> = {}
  for (const [name, value] of new URLSearchParams(text)) {
    const earlier = form[name]
    form[name] = earlier === undefined ? value : [...[earlier].flat(), value]
  }
  const result = await exchangeToken(form, request.headers)
  return answer(result.status, result.body, result.headers)
}
