import { describe, expect, it } from 'vitest'

import { readAuthorizeRequest } from './authorizeRequest'
import { approvePath } from './approveLink'
import { OAUTH_PATHS } from './constants'
import type { ConsentRequest } from './consent'

const request: ConsentRequest = {
  clientId: 'mcp_abc',
  redirectUri: 'https://claude.ai/api/mcp/auth_callback',
  state: 'state-1&x=2',
  codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  resource: 'https://sprechereast.com/api/mcp',
  scope: 'mcp',
}

describe('approvePath', () => {
  it('is the approval page with the whole request in its query, which the checks read back', () => {
    const [path, query] = approvePath(request).split('?')
    expect(path).toBe(OAUTH_PATHS.approve)
    const params = Object.fromEntries(new URLSearchParams(query))
    expect(readAuthorizeRequest(params, request.resource)).toEqual({ ok: true, request })
  })
})
