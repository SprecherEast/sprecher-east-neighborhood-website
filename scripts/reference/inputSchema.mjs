/**
 * What a tool's input schema (JSON Schema, from zod) says about each field: its type, whether it
 * is required, and every constraint the schema holds. A field that may be null puts its
 * constraints inside an `anyOf` next to the null branch, so they are read from there too.
 */

/** The schema of a field with its null branch set aside: `anyOf: [{...}, {type: 'null'}]`. */
const withoutNull = (schema) => {
  if (!schema.anyOf) return schema
  const { anyOf, ...rest } = schema
  const branches = anyOf.filter((branch) => branch.type !== 'null')
  return branches.length === 1 ? { ...rest, ...branches[0] } : schema
}

export const typeOf = (schema) => {
  if (schema.anyOf) return schema.anyOf.map(typeOf).join(' or ')
  if (schema.type === 'array') return `${schema.items ? typeOf(schema.items) : 'any'}[]`
  if (Array.isArray(schema.type)) return schema.type.join(' or ')
  return schema.type ?? 'any'
}

const countOf = (min, max, unit) => {
  if (min !== undefined && max !== undefined) return `${min} to ${max} ${unit}`
  if (max !== undefined) return `at most ${max} ${unit}`
  return min === undefined ? '' : `at least ${min} ${unit}`
}

const SAFE_INTEGER = Number.MAX_SAFE_INTEGER

const valueLimits = ({ minimum, maximum: top }) => {
  // zod adds the safe-integer range to every integer: not a limit someone wrote
  const maximum = top === SAFE_INTEGER ? undefined : top
  if (minimum !== undefined && maximum !== undefined) return `a value from ${minimum} to ${maximum}`
  if (maximum !== undefined) return `a value of at most ${maximum}`
  return minimum === undefined ? '' : `a value of at least ${minimum}`
}

const pattern = (source) => `matches \`${source}\``

/** The rarer keywords: an exclusive bound, a step, a fixed value, no repeats, no extra fields, a default. */
const otherLimits = (schema) => [
  schema.exclusiveMinimum !== undefined && `a value above ${schema.exclusiveMinimum}`,
  schema.exclusiveMaximum !== undefined && `a value below ${schema.exclusiveMaximum}`,
  schema.multipleOf !== undefined && `a multiple of ${schema.multipleOf}`,
  schema.const !== undefined && `always ${JSON.stringify(schema.const)}`,
  schema.uniqueItems && 'no repeated items',
  schema.additionalProperties === false && 'no other fields',
  schema.default !== undefined && `default ${JSON.stringify(schema.default)}`,
]

/** The constraints of one schema, in words; an array's items and an object's fields follow. */
function constraints(raw) {
  const schema = withoutNull(raw)
  return [
    schema.enum && `one of ${schema.enum.join(', ')}`,
    schema.minLength === 1 && schema.maxLength === undefined
      ? 'not empty'
      : countOf(schema.minLength, schema.maxLength, 'characters'),
    valueLimits(schema),
    countOf(schema.minItems, schema.maxItems, 'items'),
    schema.pattern && pattern(schema.pattern),
    schema.format && `format ${schema.format}`,
    ...otherLimits(schema),
    schema.items && itemFacts(schema.items),
  ].filter(Boolean)
}

function itemFacts(items) {
  const item = withoutNull(items)
  if (item.properties) return `each item has ${objectFacts(item)}`
  const found = constraints(item)
  return found.length > 0 ? `each item: ${found.join(', ')}` : ''
}

const objectFacts = (schema) =>
  Object.entries(schema.properties)
    .map(([name, property]) => {
      const required = (schema.required ?? []).includes(name) ? '' : ', optional'
      return `\`${name}\` (${[typeOf(property), ...constraints(property)].join(', ')}${required})`
    })
    .join('; ')

const NO_MESSAGE = 'a custom check with no message'

/**
 * What a check that changes the value does, found by giving it a value with spaces around, and
 * worded from its place among the checks: zod runs them in the order they were written, so the
 * limits written before it count the spaces and the ones after it do not.
 */
function overwriteNote(check, position) {
  const trims = check._zod.def.tx(' x ') === 'x'
  if (position === 0) {
    return trims
      ? 'spaces at the start and end are removed first, then the other limits apply'
      : 'the value is changed first, then the other limits apply'
  }
  return trims
    ? 'spaces at the start and end are removed after the limits written before it count them'
    : 'the value is changed after the limits written before it are checked'
}

/**
 * What one zod schema checks that the JSON schema cannot say, under optional, nullable and default
 * wrappers, in array items and in the fields of an object (named in front): the custom checks
 * (`.refine`, with the message the module wrote), and a check that changes the value (`.trim()`).
 */
function checkNotes(schema) {
  const def = schema?._zod?.def
  if (!def) return []
  const own = (def.checks ?? []).flatMap((check, position) => {
    const kind = check._zod.def.check
    if (kind === 'overwrite') return [overwriteNote(check, position)]
    if (kind !== 'custom') return []
    return [`custom check: ${check._zod.def.error?.({}) || NO_MESSAGE}`]
  })
  const fields = Object.entries(def.shape ?? {}).flatMap(([name, field]) =>
    checkNotes(field).map((note) => `\`${name}\`: ${note}`),
  )
  return [...own, ...checkNotes(def.innerType), ...checkNotes(def.element), ...fields]
}

/**
 * The notes of each field of a zod shape that its JSON schema leaves out: a `.refine` (each item
 * only once, say) and a `.trim()`. They are read from the zod schema itself.
 */
export function customChecks(shape) {
  return Object.fromEntries(
    Object.entries(shape)
      .map(([name, field]) => [name, checkNotes(field)])
      .filter(([, notes]) => notes.length > 0),
  )
}

export function describeInput(schema, checks = {}) {
  const required = new Set(schema.required)
  return Object.entries(schema.properties ?? {}).map(([name, property]) => ({
    name,
    type: typeOf(property),
    required: required.has(name) ? 'yes' : 'no',
    note: [
      (property.description ?? '').replace(/\.$/, ''),
      ...constraints(property),
      ...(checks[name] ?? []),
    ]
      .filter(Boolean)
      .join('; '),
  }))
}
