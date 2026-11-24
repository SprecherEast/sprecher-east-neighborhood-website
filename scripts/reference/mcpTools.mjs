/**
 * The AI agent tools reference (#1461, decision 0019 §4): each tool the MCP endpoint offers, read
 * from the plugin options in the agents module. The plugin makes one tool per enabled operation
 * of each content type, named as it names them (`findEvents`); the site adds its own tools, whose
 * input is read from their schema. Pure functions: the generator passes in the options, a function
 * that finds the file a function was written in, the access functions of each content type, a
 * schema converter and a function that lists the collections a file reaches.
 */
import { noFiles } from '../content-types/callbacks.mjs'
import { functionLabel } from '../content-types/functions.mjs'
import { cell, code, fileCell, generatedNotice, table } from '../content-types/render.mjs'
import { operationsSuffix } from './sourceFacts.mjs'

const COLLECTION_OPERATIONS = ['find', 'create', 'update', 'delete']
const GLOBAL_OPERATIONS = ['find', 'update']
const ACCESS_FOR = { find: 'read', create: 'create', update: 'update', delete: 'delete' }

/** The plugin's own rule for a tool name: `find` and the slug in camel case, first letter up. */
const camelCase = (text) =>
  text
    .replace(/[-_\s]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ''))
    .replace(/^(.)/, (_, chr) => chr.toLowerCase())
export const toolName = (operation, slug) =>
  `${operation}${camelCase(slug).charAt(0).toUpperCase()}${camelCase(slug).slice(1)}`

const isOn = (enabled, operation) =>
  enabled === true || (typeof enabled === 'object' && enabled?.[operation] === true)

function collectionTools(entries, operations, access) {
  return Object.keys(entries)
    .sort()
    .flatMap((slug) =>
      operations
        .filter((operation) => isOn(entries[slug].enabled, operation))
        .map((operation) => {
          const fn = access.get(slug)?.find((a) => a.operation === ACCESS_FOR[operation])
          return {
            name: toolName(operation, slug),
            operation,
            target: slug,
            description: entries[slug].description ?? '',
            access: fn ? { name: fn.name, file: fn.file } : null,
          }
        }),
    )
}

const typeOf = (schema) => {
  if (schema.anyOf) return schema.anyOf.map(typeOf).join(' or ')
  if (schema.type === 'array') return `${schema.items ? typeOf(schema.items) : 'any'}[]`
  if (Array.isArray(schema.type)) return schema.type.join(' or ')
  return schema.type ?? 'any'
}

function describeInput(schema) {
  const required = new Set(schema.required ?? [])
  return Object.entries(schema.properties ?? {}).map(([name, property]) => ({
    name,
    type: typeOf(property),
    required: required.has(name) ? 'yes' : 'no',
    note: [property.description, property.enum && `one of ${property.enum.join(', ')}`]
      .filter(Boolean)
      .join('; '),
  }))
}

/** Everything the page says, as data. */
export function describeMcp(
  options,
  { locate = noFiles, access = new Map(), schemaOf, calls = () => [] },
) {
  const authName = options.overrideAuth ? functionLabel(options.overrideAuth, 'auth').name : ''
  return {
    server: options.mcp?.serverOptions?.serverInfo?.name ?? '',
    auth: options.overrideAuth
      ? { name: authName, file: locate(options.overrideAuth) }
      : { name: 'the plugin’s own key check', file: '@payloadcms/plugin-mcp' },
    collectionTools: [
      ...collectionTools(options.collections ?? {}, COLLECTION_OPERATIONS, access),
      ...collectionTools(options.globals ?? {}, GLOBAL_OPERATIONS, access),
    ],
    customTools: (options.mcp?.tools ?? []).map((tool) => {
      const file = locate(tool.handler)
      return {
        name: tool.name,
        description: tool.description,
        file,
        input: describeInput(schemaOf(tool.parameters)),
        collections: file.startsWith('src/') ? calls(file) : [],
      }
    }),
  }
}

/** Content type slug to the names of the tools that reach it, plugin tools first. */
export function toolNamesByCollection(mcp) {
  const found = new Map()
  const add = (slug, name) => found.set(slug, [...(found.get(slug) ?? []), name])
  for (const tool of mcp.collectionTools) add(tool.target, tool.name)
  for (const tool of mcp.customTools) {
    for (const { collection } of tool.collections) add(collection, tool.name)
  }
  return new Map([...found].map(([slug, names]) => [slug, [...new Set(names)].sort()]))
}

export function renderMcp(mcp) {
  const plugin = table(
    ['Tool', 'Content type', 'Operation', 'Access function behind it', 'Description'],
    mcp.collectionTools.map((tool) => [
      code(tool.name),
      `[${code(tool.target)}](content-types/${tool.target}.md)`,
      tool.operation,
      tool.access
        ? `${code(tool.access.name)} in ${fileCell(tool.access.file)}`
        : 'Payload’s default',
      cell(tool.description),
    ]),
  )
  const custom = mcp.customTools.map((tool) =>
    [
      `### ${code(tool.name)}`,
      '',
      cell(tool.description),
      '',
      `Written in ${fileCell(tool.file)}.`,
      tool.collections.length > 0
        ? `\nReaches: ${tool.collections.map((c) => `[${code(c.collection)}](content-types/${c.collection}.md)${operationsSuffix(c.operations)}`).join(', ')}.`
        : '',
      '',
      table(
        ['Input', 'Type', 'Required', 'Notes'],
        tool.input.map((field) => [
          code(field.name),
          cell(field.type),
          field.required,
          cell(field.note),
        ]),
      ),
      '',
    ].join('\n'),
  )
  return [
    '# AI agent tools (MCP)',
    '',
    generatedNotice('the MCP plugin options in the agents module and the loaded Payload config'),
    '',
    `AI agents connect to ${code(mcp.server)} at the MCP endpoint (see [endpoints.md](endpoints.md)). Each request carries an API key that acts as an agent account; the key is checked by ${code(mcp.auth.name)} in ${fileCell(mcp.auth.file)}. The content type’s own access functions decide what a tool may do, and a key’s settings in Admin can only narrow that. “Reaches” is read from the tool’s own code: the collections it finds, creates, updates or deletes through Payload’s Local API.`,
    '',
    '## Tools the plugin makes for content types',
    '',
    plugin,
    '',
    '## Tools the site adds',
    '',
    ...custom,
  ].join('\n')
}
