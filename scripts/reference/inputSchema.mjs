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

export function describeInput(schema) {
  const required = new Set(schema.required ?? [])
  return Object.entries(schema.properties ?? {}).map(([name, property]) => ({
    name,
    type: typeOf(property),
    required: required.has(name) ? 'yes' : 'no',
    note: [(property.description ?? '').replace(/\.$/, ''), ...constraints(property)]
      .filter(Boolean)
      .join('; '),
  }))
}
