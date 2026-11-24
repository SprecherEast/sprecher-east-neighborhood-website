/**
 * The endpoints reference (#1461, decision 0019 §4): every way into the application that is not a
 * site page. Read from the loaded Payload config (routes, GraphQL settings, custom endpoints), the
 * route files and the MCP setup. Pure functions: the generator passes in what it loaded, and a
 * function that finds the file a function was written in.
 */
import { findReplaced, groupBuiltIn } from './builtInRoutes.mjs'
import { noFiles } from '../content-types/callbacks.mjs'
import { functionLabel } from '../content-types/functions.mjs'
import { cell, code, fileCell, generatedNotice, table } from '../content-types/render.mjs'

const MCP_PLUGIN = '@payloadcms/plugin-mcp'

/**
 * Everything the page says, as data. `endpoints` are the config's own, `contentTypes` carry the
 * custom endpoints already described for the content-type pages, `routeHandlers` are the route
 * files and `mcpAuth` the function that checks an MCP request's key.
 */
export function describeApi(input, locate = noFiles) {
  const { routes, graphQL, endpoints, contentTypes, routeHandlers, mcpAuth } = input
  const { appFiles = [], publicFiles = [] } = input
  const api = routes.api
  const rest = contentTypes
    .map((type) => ({
      slug: type.slug,
      kind: type.kind,
      path: type.rest ? `${api}${type.kind === 'global' ? '/globals' : ''}/${type.slug}` : '',
      enabled: type.rest,
      graphQL: type.graphQL,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug))

  const fromConfig = endpoints.map((endpoint) => {
    const file = locate(endpoint.handler)
    return {
      owner: 'config',
      method: String(endpoint.method).toUpperCase(),
      path: `${api}${endpoint.path}`,
      name: functionLabel(endpoint.handler, 'handler').name,
      file,
      guard: file === MCP_PLUGIN ? code(mcpAuth.name) : '',
    }
  })
  const fromTypes = contentTypes.flatMap((type) =>
    type.endpoints.map((endpoint) => ({
      owner: type.slug,
      method: endpoint.method,
      path: `${api}${type.kind === 'global' ? '/globals' : ''}/${type.slug}${endpoint.path}`,
      name: endpoint.name,
      file: endpoint.file,
      guard: '',
    })),
  )

  const builtIn = groupBuiltIn(contentTypes)
  const { rules = [], ...settings } = graphQL
  return {
    api,
    rest,
    graphQL: {
      path: `${api}${routes.graphQL}`,
      playground: `${api}${routes.graphQLPlayground}`,
      settings: Object.entries(settings).map(([key, value]) => [key, String(value)]),
      rules: rules.map((rule) => ({
        name: functionLabel(rule, 'validationRule').name,
        file: locate(rule),
      })),
    },
    custom: [...fromConfig, ...fromTypes],
    builtIn,
    replaced: findReplaced(contentTypes),
    appFiles,
    publicFiles,
    adminPages: input.adminPages,
    serverActions: input.serverActions,
    routeHandlers: [...routeHandlers].sort(
      (a, b) => a.url.localeCompare(b.url) || a.file.localeCompare(b.file),
    ),
    mcp: { path: `${api}/mcp`, auth: mcpAuth },
  }
}
