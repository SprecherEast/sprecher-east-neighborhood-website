/**
 * The endpoints page (#1461): tables written from what `describeApi` found, one function per
 * table, and the sentences around them.
 */
import { cell, code, fileCell, generatedNotice, table } from '../content-types/render.mjs'

const handlersTable = (rows) =>
  table(
    ['URL', 'Methods', 'File'],
    rows.map((row) => [code(row.url), row.methods.join(', '), code(row.file)]),
  )

const filesTable = (rows) =>
  table(
    ['URL', 'File', 'Made by'],
    rows.map((row) => [
      code(row.url),
      code(row.file),
      row.generated
        ? `code${row.readsContent ? ' that reads site content through Payload' : ''}`
        : 'the file itself',
    ]),
  )

const restTable = (rows) =>
  table(
    ['Content type', 'Kind', 'REST path', 'GraphQL'],
    rows.map((row) => [
      `[${code(row.slug)}](content-types/${row.slug}.md)`,
      row.kind,
      row.enabled ? code(row.path) : 'REST switched off',
      row.graphQL ? 'on' : 'off',
    ]),
  )

const builtInTable = (rows) =>
  table(
    ['Method', 'Path after the type’s own', 'Content types'],
    rows.map((row) => [row.method, code(row.path), row.scope || row.types.map(code).join(', ')]),
  )

const replacedTable = (rows) =>
  table(
    ['Method', 'Path', 'Content type', 'Taken first by', 'Which requests', 'Defined in'],
    rows.map((row) => [
      row.method,
      code(row.path),
      code(row.slug),
      code(row.by.path),
      row.when ? `only a request to ${row.when.map(code).join(', ')}` : 'every request',
      fileCell(row.by.file),
    ]),
  )

const adminTable = (rows) =>
  table(
    ['URL', 'File'],
    rows.map((row) => [code(row.url), code(row.file)]),
  )

const actionsTable = (rows) =>
  table(
    ['Where', 'Function', 'File'],
    rows.map((row) => [row.area, code(row.name), code(row.file)]),
  )

const graphQLTable = (graphQL) =>
  table(
    ['Setting', 'Value'],
    [
      ['Endpoint', code(graphQL.path)],
      ['Playground', code(graphQL.playground)],
      ...graphQL.settings.map(([key, value]) => [code(key), cell(value)]),
      ...graphQL.rules.map((rule) => [
        'Validation rule',
        `${code(rule.name)} in ${fileCell(rule.file)}`,
      ]),
    ],
  )

const customTable = (rows) =>
  table(
    ['Method', 'Path', 'Added by', 'Handler', 'Defined in', 'Access check'],
    rows.map((row) => [
      row.method,
      code(row.path),
      row.owner === 'config' ? 'the config or a plugin' : code(row.owner),
      row.name === 'inline' ? 'inline' : code(row.name),
      fileCell(row.file),
      row.guard || 'inside the handler',
    ]),
  )

const NOT_SHOWN =
  'Not shown: the access check inside a custom endpoint, a route handler or a server action; Next.js’s own routes and the proxy (`src/proxy.ts`); the redirects and response headers `next.config.js` sets; the services the server runs next to the application (analytics behind its own Caddy host, the pull request previews), which `ops/README.md` and `ops/caddy/` describe; and what a plugin’s endpoint does beyond its handler’s name.'

export function renderApi(data) {
  return [
    '# Endpoints',
    '',
    generatedNotice('the loaded Payload config, the route files and the MCP setup'),
    '',
    'Every way into the application that is not a site page, except what is listed under [Not shown](#not-shown): the route files, the files Next.js serves by name (robots, sitemap, icons, `public/`), the REST and GraphQL APIs Payload builds from the content types, the custom endpoints, and the endpoint AI agents use. Site pages are in [routes.md](routes.md). Who may do what on each content type is on its page, under Access.',
    '',
    '## Route files',
    '',
    'The access check of a route handler is inside it and is not shown.',
    '',
    handlersTable(data.routeHandlers),
    '',
    '## Files Next.js serves by name',
    '',
    'Next.js makes a URL from a file in the `app` folder named for a metadata convention (robots, sitemap, icons, manifest, social images), and serves everything in `public/` from `/`. The conventions are those of the Next.js file-convention docs.',
    '',
    filesTable(data.appFiles),
    '',
    `In \`public/\`: ${data.publicFiles.map(code).join(', ') || 'nothing'}.`,
    '',
    '## Payload Admin',
    '',
    'The Admin app, with its own server function (below).',
    '',
    adminTable(data.adminPages),
    '',
    '## Server actions',
    '',
    "Each is a POST endpoint the browser calls by itself, from a function marked `'use server'`. Who may call one is decided inside the function and is not shown.",
    '',
    actionsTable(data.serverActions),
    '',
    '## REST API',
    '',
    `Payload builds a REST API for each content type under \`${data.api}\`, guarded by the content type’s access functions (the routes that run jobs are guarded by the \`run\` access of the jobs setting instead, see [jobs.md](jobs.md)), and the GraphQL API for the types marked on.`,
    '',
    restTable(data.rest),
    '',
    '### Routes Payload adds to content types',
    '',
    'The routes in the loaded config that Payload adds to content types (find, create, update and delete are among them), each after the type’s own path (`/api/<slug>` or `/api/globals/<slug>`).',
    '',
    builtInTable(data.builtIn),
    '',
    '### Routes Payload adds that an earlier endpoint takes first',
    '',
    'Payload answers a request with the first endpoint of the type whose method and path match. These routes are in the type’s list, but an endpoint before them takes the requests they would get, so they are not reachable, or only for some requests. A path with an optional part (`:id?`) is asked with and without it, and `:name` matches one segment.',
    '',
    replacedTable(data.replaced),
    '',
    '## GraphQL API',
    '',
    'Built from the same content types and access functions.',
    '',
    graphQLTable(data.graphQL),
    '',
    '## Custom endpoints',
    '',
    'Added by the config, a plugin or a content type. The access check of one is set inside its handler, which the config does not show, except the MCP endpoint, whose key check the config names.',
    '',
    customTable(data.custom),
    '',
    '## Not shown',
    '',
    NOT_SHOWN,
    '',
    '## MCP endpoint',
    '',
    `AI agents connect at \`${data.mcp.path}\`, with an API key that acts as an agent account. The key is checked by ${code(data.mcp.auth.name)} in ${fileCell(data.mcp.auth.file)}. The tools, their input and the content types they reach are in [mcp-tools.md](mcp-tools.md). What runs on a timer is in [jobs.md](jobs.md).`,
    '',
  ].join('\n')
}
