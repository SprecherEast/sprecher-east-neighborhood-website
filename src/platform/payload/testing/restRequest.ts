import { REST_DELETE, REST_GET, REST_PATCH, REST_POST } from '@payloadcms/next/routes'
import type { SanitizedConfig } from 'payload'

const HANDLERS = { GET: REST_GET, POST: REST_POST, PATCH: REST_PATCH, DELETE: REST_DELETE }

/**
 * Sends a JSON request to Payload's REST API, as the site's `/api` route does, with a sign-in
 * token when given. For tests of who may read or write what.
 */
export async function restRequest(
  config: SanitizedConfig,
  method: keyof typeof HANDLERS,
  path: string[],
  { body = {}, token }: { body?: Record<string, unknown>; token?: string } = {},
): Promise<Response> {
  const handler = HANDLERS[method](Promise.resolve(config))
  const request = new Request(`http://localhost:3000/api/${path.join('/')}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `JWT ${token}` } : {}),
    },
    body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(body),
  })
  return handler(request, { params: Promise.resolve({ slug: path }) })
}
