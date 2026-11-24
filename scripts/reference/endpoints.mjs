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

/** The routes Payload adds to content types, one per method and path, with the types that have it. */
function groupBuiltIn(contentTypes) {
  const found = new Map()
  for (const type of contentTypes) {
    for (const endpoint of type.allEndpoints) {
      if (endpoint.file !== 'payload') continue
      const key = `${endpoint.method} ${endpoint.path}`
      const entry = found.get(key) ?? { method: endpoint.method, path: endpoint.path, types: [] }
      entry.types.push(type.slug)
      found.set(key, entry)
    }
  }
  const scopeOf = (types) =>
    ['collection', 'global']
      .map((kind) => {
        const all = contentTypes.filter((t) => t.kind === kind).map((t) => t.slug)
        const has = all.filter((slug) => types.includes(slug))
        const missing = all.filter((slug) => !types.includes(slug))
        if (has.length === 0) return ''
        if (has.length <= missing.length) return null
        return missing.length === 0
          ? `every ${kind}`
          : `every ${kind} except ${missing
              .sort()
              .map((slug) => `\`${slug}\``)
              .join(', ')}`
      })
      .filter((piece) => piece !== '')
      .reduce((all, piece) => (all === null || piece === null ? null : [...all, piece]), [])
      ?.join('; ') ?? ''
  return [...found.values()]
    .map((entry) => ({ ...entry, types: entry.types.sort(), scope: scopeOf(entry.types) }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
}

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
    adminPages: input.adminPages,
    serverActions: input.serverActions,
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
    ['Content type', 'Kind', 'REST path', 'GraphQL'],
    data.rest.map((row) => [
      `[${code(row.slug)}](content-types/${row.slug}.md)`,
      row.kind,
      row.enabled ? code(row.path) : 'REST switched off',
      row.graphQL ? 'on' : 'off',
    ]),
  )
  const builtIn = table(
    ['Method', 'Path after the type’s own', 'Content types'],
    data.builtIn.map((row) => [
      row.method,
      code(row.path),
      row.scope || row.types.map(code).join(', '),
    ]),
  )
  const admin = table(
    ['URL', 'File'],
    data.adminPages.map((row) => [code(row.url), code(row.file)]),
  )
  const actions = table(
    ['Where', 'Function', 'File'],
    data.serverActions.map((row) => [row.area, code(row.name), code(row.file)]),
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
    'The access check of a route handler is inside it and is not shown.',
    '',
    handlers,
    '',
    '## Payload Admin',
    '',
    'The Admin app, with its own server function (below).',
    '',
    admin,
    '',
    '## Server actions',
    '',
    "Each is a POST endpoint the browser calls by itself, from a function marked `'use server'`. Who may call one is decided inside the function and is not shown.",
    '',
    actions,
    '',
    '## REST API',
    '',
    `Payload builds a REST API for each content type under \`${data.api}\`, guarded by the content type’s access functions, and the GraphQL API for the types marked on.`,
    '',
    rest,
    '',
    '### Routes Payload adds to content types',
    '',
    'Besides find, create, update and delete, the loaded config gives these routes, each after the type’s own path (`/api/<slug>` or `/api/globals/<slug>`).',
    '',
    builtIn,
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
    '## Not shown',
    '',
    'Not shown: the access check inside a custom endpoint, a route handler or a server action; Next.js’s own routes and the proxy (`src/proxy.ts`); and what a plugin’s endpoint does beyond its handler’s name.',
    '',
    '## MCP endpoint',
    '',
    `AI agents connect at \`${data.mcp.path}\`, with an API key that acts as an agent account. The key is checked by ${code(data.mcp.auth.name)} in ${fileCell(data.mcp.auth.file)}. The tools, their input and the content types they reach are in [mcp-tools.md](mcp-tools.md). What runs on a timer is in [jobs.md](jobs.md).`,
    '',
  ].join('\n')
}
