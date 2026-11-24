/** The loaded-config stand-in the endpoints tests share. */

export function checkKey() {}
function maskVerify() {}
function seoHandler() {}
function mcpHandler() {}
export const locate = (fn) =>
  ({
    [checkKey]: 'src/modules/agents/cms/mcp.ts',
    [maskVerify]: 'src/modules/accounts/cms/noVerifyMutation.ts',
    [seoHandler]: '@payloadcms/plugin-seo',
    [mcpHandler]: '@payloadcms/plugin-mcp',
  })[fn] ?? 'payload'

export const base = {
  routes: { api: '/api', graphQL: '/graphql', graphQLPlayground: '/graphql-playground' },
  graphQL: {
    disableIntrospectionInProduction: true,
    disablePlaygroundInProduction: true,
    maxComplexity: 1000,
    rules: [maskVerify],
  },
  endpoints: [
    { method: 'post', path: '/plugin-seo/generate-title', handler: seoHandler },
    { method: 'post', path: '/mcp', handler: mcpHandler },
    { method: 'get', path: '/mcp', handler: mcpHandler },
  ],
  contentTypes: [
    {
      slug: 'events',
      kind: 'collection',
      rest: true,
      graphQL: true,
      endpoints: [{ method: 'POST', path: '/verify/:token', name: 'verify', file: 'src/v.ts' }],
      allEndpoints: [
        { method: 'GET', path: '/count', name: 'countHandler', file: 'payload' },
        { method: 'POST', path: '/login', name: 'loginHandler', file: 'payload' },
        { method: 'POST', path: '/verify/:token', name: 'verify', file: 'src/v.ts' },
        {
          method: 'POST',
          path: '/verify/:id',
          name: 'verifyHandler',
          file: 'payload',
          replacedBy: { method: 'POST', path: '/verify/:token', name: 'verify', file: 'src/v.ts' },
        },
      ],
    },
    {
      slug: 'faq',
      kind: 'collection',
      rest: true,
      graphQL: true,
      endpoints: [],
      allEndpoints: [{ method: 'GET', path: '/count', name: 'countHandler', file: 'payload' }],
    },
    { slug: 'header', kind: 'global', rest: true, graphQL: true, endpoints: [], allEndpoints: [] },
    {
      slug: 'agent-runs',
      kind: 'collection',
      rest: false,
      graphQL: false,
      endpoints: [],
      allEndpoints: [],
    },
  ],
  adminPages: [{ url: '/admin/[[...segments]]', file: 'src/app/(payload)/admin/page.tsx' }],
  serverActions: [
    { file: 'src/modules/accounts/actions.ts', name: 'signIn', area: 'module `accounts`' },
  ],
  routeHandlers: [
    { url: '/api/version', methods: ['GET'], file: 'src/app/(frontend)/api/version/route.ts' },
    {
      url: '/api/[...slug]',
      methods: ['GET', 'POST'],
      file: 'src/app/(payload)/api/[...slug]/route.ts',
    },
  ],
  mcpAuth: { name: 'checkKey', file: 'src/modules/agents/cms/mcp.ts' },
}
