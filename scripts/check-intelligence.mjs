#!/usr/bin/env node
// Checks intelligence/ (#337, #352): YAML against schemas, prompts, and eval routes, sources,
// offsets and graders. Run: node scripts/check-intelligence.mjs [folder]. ajv and js-yaml are
// declared in package.json (#343, #445). Exits 1 with a list of problems.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import yaml from 'js-yaml'

import { boundaryProblems } from '../intelligence/runner/lib/boundary.mjs'
import { safetyRules, unregisteredSafetySources } from '../intelligence/runner/lib/safety.mjs'
import { backgroundChecks } from './check-intelligence-background.mjs'
import { offsetProblems } from './check-intelligence-times.mjs'
import { routeProblems } from './check-intelligence-routes.mjs'
import { parseFrontmatter } from './frontmatter.mjs'

const dir = path.resolve(process.argv[2] ?? 'intelligence')
const problems = []
const problem = (file, message) =>
  problems.push(`${path.relative(process.cwd(), file)}: ${message}`)

// JSON_SCHEMA keeps dates such as 2026-10-24 as strings, as the schemas expect.
const readYaml = (file) => yaml.load(readFileSync(file, 'utf8'), { schema: yaml.JSON_SCHEMA })

const ajv = new Ajv2020({ allErrors: true, strict: true })
const schemaDir = path.join(dir, 'schemas')
const schemaFiles = readdirSync(schemaDir).filter((name) => name.endsWith('.schema.json'))
const idOf = {}
for (const name of schemaFiles) {
  const file = path.join(schemaDir, name)
  try {
    const schema = JSON.parse(readFileSync(file, 'utf8'))
    ajv.addSchema(schema)
    idOf[`schemas/${name}`] = schema.$id
  } catch (error) {
    problem(file, `not a valid schema: ${error.message}`)
  }
}
// A schema that doesn't compile (a broken $ref, a bad keyword) is reported once, then left out.
const compiled = {}
for (const [name, id] of Object.entries(idOf)) {
  try {
    compiled[name] = ajv.getSchema(id)
  } catch (error) {
    problem(path.join(dir, name), `does not compile: ${error.message}`)
  }
}
const schemaAt = (ref) => {
  try {
    return ajv.getSchema(ref)?.schema
  } catch {
    return undefined
  }
}

function validate(file, schemaName) {
  if (!existsSync(file)) return (problem(file, 'missing'), undefined)
  let data
  try {
    data = readYaml(file)
  } catch (error) {
    return (problem(file, `not valid YAML: ${error.message}`), undefined)
  }
  const check = compiled[schemaName]
  if (!check) return (problem(file, `schema ${schemaName} is missing or broken`), undefined)
  try {
    if (!check(data)) {
      for (const e of check.errors) problem(file, `${e.instancePath || '/'} ${e.message}`)
    }
  } catch (error) {
    // ajv compiles referenced schemas on first use, so a broken one can surface only here
    problem(file, `${schemaName} or a schema it references is broken: ${error.message}`)
  }
  return data
}

function duplicates(values) {
  return values.filter((value, index) => value != null && values.indexOf(value) !== index)
}

// 1. The data files
const sources = validate(path.join(dir, 'sources.yaml'), 'schemas/sources.schema.json')
if (sources?.sources) {
  const list = sources.sources
  for (const id of duplicates(list.map((s) => s.id)))
    problem(path.join(dir, 'sources.yaml'), `duplicate id ${id}`)
  for (const rank of duplicates(list.map((s) => s.pilotRank)))
    problem(path.join(dir, 'sources.yaml'), `two sources share pilotRank ${rank}`)
}
// Eval cases: one file per stage, `<stage>.yaml` or `<stage>-<topic>.yaml`
const evalDir = path.join(dir, 'evals')
const evalFiles = existsSync(evalDir)
  ? readdirSync(evalDir).filter((name) => name.endsWith('.yaml'))
  : []
if (evalFiles.length === 0) problem(evalDir, 'no eval files')
const cases = []
for (const name of evalFiles) {
  const file = path.join(evalDir, name)
  const data = validate(file, 'schemas/eval-cases.schema.json')
  if (!data?.cases) continue
  if (!name.startsWith(`${data.stage}.`) && !name.startsWith(`${data.stage}-`))
    problem(file, `file name must start with its stage, ${data.stage}`)
  for (const c of data.cases) {
    if (c.stage !== data.stage) problem(file, `${c.id}: stage ${c.stage} in a ${data.stage} file`)
    cases.push({ ...c, file })
  }
}
for (const id of duplicates(cases.map((c) => c.id))) problem(evalDir, `duplicate case id ${id}`)
const pipeline = validate(path.join(dir, 'pipeline.yaml'), 'schemas/pipeline.schema.json')
const area = validate(path.join(dir, pipeline?.area ?? 'area.yaml'), 'schemas/area.schema.json')
// The dated copy of the City's boundary: its schema, then the geometry and that it is the record's feature (#1009)
if (area?.boundary) {
  const file = path.join(dir, area.boundary.file)
  const copy = validate(file, 'schemas/boundary.schema.json')
  if (copy) for (const message of boundaryProblems(copy, area.boundary)) problem(file, message)
}
const safety = validate(
  path.join(dir, pipeline?.safety ?? 'safety.yaml'),
  'schemas/safety.schema.json',
)
for (const id of unregisteredSafetySources(safety, sources))
  problem(path.join(dir, 'safety.yaml'), `sources: ${id} is not in sources.yaml`)
const ROUTE = pipeline?.routes ?? {}
const rules = safety ? safetyRules(safety) : null
const registry = new Map(sources?.sources?.map((s) => [s.id, s]) ?? [])
for (const c of cases) {
  const others = [c.input?.otherSources, c.input?.alsoReportedBy].flat().filter(Boolean)
  const named = [c.input?.sourceId, ...others.map((o) => o.sourceId)]
  for (const id of [...named, ...(c.given?.sources ?? []).map((o) => o.id)])
    if (!registry.has(id)) problem(c.file, `${c.id}: no source ${id}`)
  // Only a pending source may be overridden: never a restricted or invalid one
  for (const o of c.given?.sources ?? []) {
    const actual = registry.get(o.id)?.result
    if (actual !== 'pending')
      problem(c.file, `${c.id}: ${o.id} is ${actual}; only pending can be overridden`)
  }
  const source = registry.get(c.input?.sourceId)
  const viaPlaywright = c.input?.responses?.some((r) => r.via === 'playwright')
  if (
    (viaPlaywright || c.expected?.fetchStrategy === 'playwright') &&
    source?.fetchStrategy !== 'direct-then-playwright'
  )
    problem(c.file, `${c.id}: Playwright needs ${c.input?.sourceId} to be direct-then-playwright`)
  // A scout case that fetches needs a valid source, in the registry or as a fixture override
  if (c.stage === 'scout') {
    const override = c.given?.sources?.find((o) => o.id === c.input?.sourceId)
    const result = override?.result ?? source?.result
    if ((c.expected?.runStatus === 'skipped') === (result === 'valid'))
      problem(c.file, `${c.id}: runStatus ${c.expected?.runStatus} with a ${result} source`)
  }
  for (const message of offsetProblems(c)) problem(c.file, message)
  for (const message of routeProblems(c, { routes: ROUTE, registry, rules }))
    problem(c.file, message)
}

// The background files fit the one budget, and the cases that name a background follow it (#1434)
for (const [file, message] of backgroundChecks(dir, cases, pipeline)) problem(file, message)

// 2. Field paths: `$.a.b`, with `[]` stepping into an array's items
function lookup(schema, segments, baseId) {
  if (!schema || typeof schema !== 'object') return false
  if (schema.$ref) {
    const target = new URL(schema.$ref, baseId).href
    const resolved = schemaAt(target)
    return lookup(resolved, segments, target.split('#')[0])
  }
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    if (schema[key]?.some((branch) => lookup(branch, segments, baseId))) return true
  }
  if (segments.length === 0) return true
  const [head, ...rest] = segments
  const isArray = head.endsWith('[]')
  const next = schema.properties?.[isArray ? head.slice(0, -2) : head]
  if (!next) return false
  return isArray ? items(next, rest, baseId) : lookup(next, rest, baseId)
}
function items(schema, rest, baseId) {
  if (schema.$ref) {
    const target = new URL(schema.$ref, baseId).href
    return items(schemaAt(target) ?? {}, rest, target.split('#')[0])
  }
  if (schema.items) return lookup(schema.items, rest, baseId)
  return ['anyOf', 'oneOf'].some((key) =>
    schema[key]?.some((branch) => items(branch, rest, baseId)),
  )
}

// 3. Stages and their prompts
for (const stage of pipeline?.stages ?? []) {
  const file = path.join(dir, stage.prompt)
  if (!existsSync(file)) {
    problem(file, `missing (stage ${stage.id})`)
    continue
  }
  const text = readFileSync(file, 'utf8')
  const meta = parseFrontmatter(text, { schema: yaml.JSON_SCHEMA })
  if (meta?.stage !== stage.id || meta?.input !== stage.input || meta?.output !== stage.output) {
    problem(
      file,
      `front matter must say stage: ${stage.id}, input: ${stage.input}, output: ${stage.output}`,
    )
  }
  for (const section of ['Untrusted content', 'Unknowns']) {
    if (!new RegExp(`^## ${section}$`, 'm').test(text))
      problem(file, `needs a "## ${section}" section`)
  }
  const schemas = [stage.input, stage.output].map((name) => compiled[name] && idOf[name])
  if (schemas.includes(undefined)) {
    problem(file, `input or output schema is not in schemas/`)
    continue
  }
  const paths = [...text.matchAll(/`\$\.([A-Za-z0-9_.[\]]+)`/g)].map((m) => m[1])
  if (paths.length === 0) problem(file, 'names no fields (`$.field`)')
  for (const fieldPath of new Set(paths)) {
    const segments = fieldPath.split('.')
    if (!schemas.some((id) => lookup(schemaAt(id), segments, id))) {
      problem(file, `\`$.${fieldPath}\` is not a field of ${stage.input} or ${stage.output}`)
    }
  }
}

// 4. Graders name fields of their stage's input or output schema
const stageSchemas = Object.fromEntries(
  (pipeline?.stages ?? []).map((stage) => [stage.id, [stage.input, stage.output]]),
)
for (const c of cases) {
  for (const grader of c.graders ?? []) {
    if (!grader.field) continue
    const names = stageSchemas[c.stage] ?? []
    const segments = grader.field.slice(2).split('.')
    if (!names.some((name) => compiled[name] && lookup(schemaAt(idOf[name]), segments, idOf[name])))
      problem(c.file, `${c.id}: grader field ${grader.field} is not in ${names.join(' or ')}`)
  }
}

if (problems.length) {
  console.error(`intelligence/ check failed:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log(
  `intelligence/ check passed: ${sources.sources.length} sources, ${cases.length} eval cases ` +
    `in ${evalFiles.length} files, ` +
    `${pipeline.stages.length} stages, ${schemaFiles.length} schemas.`,
)
