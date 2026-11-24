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
import { operationsSuffix } from './collectionCalls.mjs'

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

const itemLimits = ({ minItems, maxItems }) => {
  if (minItems !== undefined && maxItems !== undefined) return `${minItems} to ${maxItems} items`
  if (maxItems !== undefined) return `at most ${maxItems} items`
  return minItems === undefined ? '' : `at least ${minItems} items`
}

function describeInput(schema) {
  const required = new Set(schema.required ?? [])
  return Object.entries(schema.properties ?? {}).map(([name, property]) => ({
    name,
    type: typeOf(property),
    required: required.has(name) ? 'yes' : 'no',
    note: [
      property.description?.replace(/\.$/, ''),
      property.enum && `one of ${property.enum.join(', ')}`,
      property.maxLength && `at most ${property.maxLength} characters`,
      itemLimits(property),
      property.pattern && 'matches a fixed pattern',
      property.format && `format ${property.format}`,
    ]
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
        collections: file.startsWith('src/') ? calls(file, tool.name) : [],
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

/** Why a call skips access, in the words of the comment above the function that makes it. */
const whyLines = (collections) =>
  collections
    .flatMap((c) =>
      c.why.map(
        (w) => `\n- ${code(c.collection)}, ${w.operation}, as the code says: ${cell(w.text)}`,
      ),
    )
    .join('')

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
        ? `\nReaches: ${tool.collections.map((c) => `[${code(c.collection)}](content-types/${c.collection}.md)${operationsSuffix(c.operations)}`).join(', ')}.${whyLines(tool.collections)}`
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
    `AI agents connect to ${code(mcp.server)} at the MCP endpoint (see [endpoints.md](endpoints.md)). Each request carries an API key that acts as an agent account; the key is checked by ${code(mcp.auth.name)} in ${fileCell(mcp.auth.file)}. For the tools the plugin makes, the content type’s access functions decide what a tool may do, and a key’s settings in Admin can only narrow that. The site’s own tools call Payload’s Local API themselves, which skips access unless a call says \`overrideAccess: false\`: each collection a tool reaches is marked “access checked” or “access bypassed”, with the reason where the code gives one. “Reaches” is found by following the tool’s handler through the functions it calls in the source; a function passed in by the config is not followed.`,
    '',
    '## Tools the plugin makes for content types',
    '',
    'The input of these tools (the plugin’s standard parameters for finding, creating and updating) is defined by the plugin and is not shown here; see [the plugin’s documentation](https://payloadcms.com/docs/plugins/mcp).',
    '',
    plugin,
    '',
    '## Tools the site adds',
    '',
    ...custom,
  ].join('\n')
}
