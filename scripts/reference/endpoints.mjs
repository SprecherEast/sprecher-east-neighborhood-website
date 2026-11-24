/**
 * The endpoints reference (#1461, decision 0019 §4): every way into the application that is not a
 * site page. Read from the loaded Payload config (routes, GraphQL settings, custom endpoints), the
 * route files and the MCP setup. Pure functions: the generator passes in what it loaded, and a
 * function that finds the file a function was written in.
 */
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
  const api = routes.api
  const rest = contentTypes
    .map((type) => ({
      slug: type.slug,
      kind: type.kind,
      path: type.rest ? `${api}${type.kind === 'global' ? '/globals' : ''}/${type.slug}` : '',
      enabled: type.rest,
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
    routeHandlers: [...routeHandlers].sort(
      (a, b) => a.url.localeCompare(b.url) || a.file.localeCompare(b.file),
    ),
    mcp: { path: `${api}/mcp`, auth: mcpAuth },
  }
}

export function renderApi(data) {
  const handlers = table(
    ['URL', 'Methods', 'File'],
    data.routeHandlers.map((row) => [code(row.url), row.methods.join(', '), code(row.file)]),
  )
  const rest = table(
    ['Content type', 'Kind', 'REST path'],
    data.rest.map((row) => [
      `[${code(row.slug)}](content-types/${row.slug}.md)`,
      row.kind,
      row.enabled ? code(row.path) : 'REST switched off',
    ]),
  )
  const graphQL = table(
    ['Setting', 'Value'],
    [
      ['Endpoint', code(data.graphQL.path)],
      ['Playground', code(data.graphQL.playground)],
      ...data.graphQL.settings.map(([key, value]) => [code(key), cell(value)]),
      ...data.graphQL.rules.map((rule) => [
        'Validation rule',
        `${code(rule.name)} in ${fileCell(rule.file)}`,
      ]),
    ],
  )
  const custom = table(
    ['Method', 'Path', 'Added by', 'Handler', 'Defined in', 'Access check'],
    data.custom.map((row) => [
      row.method,
      code(row.path),
      row.owner === 'config' ? 'the config or a plugin' : code(row.owner),
      row.name === 'inline' ? 'inline' : code(row.name),
      fileCell(row.file),
      row.guard || 'inside the handler',
    ]),
  )
  return [
    '# Endpoints',
    '',
    generatedNotice('the loaded Payload config, the route files and the MCP setup'),
    '',
    'Every way into the application that is not a site page: the route files, the REST and GraphQL APIs Payload builds from the content types, the custom endpoints, and the endpoint AI agents use. Site pages are in [routes.md](routes.md). Who may do what on each content type is on its page, under Access.',
    '',
    '## Route files',
    '',
    handlers,
    '',
    '## REST API',
    '',
    `Payload builds a REST API for each content type under \`${data.api}\`: find, create, update and delete, each guarded by the content type’s access functions.`,
    '',
    rest,
    '',
    '## GraphQL API',
    '',
    'Built from the same content types and access functions.',
    '',
    graphQL,
    '',
    '## Custom endpoints',
    '',
    'Added by the config, a plugin or a content type. The access check of one is set inside its handler, which the config does not show, except the MCP endpoint, whose key check the config names.',
    '',
    custom,
    '',
    '## MCP endpoint',
    '',
    `AI agents connect at \`${data.mcp.path}\`, with an API key that acts as an agent account. The key is checked by ${code(data.mcp.auth.name)} in ${fileCell(data.mcp.auth.file)}. The tools, their input and the content types they reach are in [mcp-tools.md](mcp-tools.md). What runs on a timer is in [jobs.md](jobs.md).`,
    '',
  ].join('\n')
}
