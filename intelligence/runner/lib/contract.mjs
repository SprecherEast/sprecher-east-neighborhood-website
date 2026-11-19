import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import yaml from 'js-yaml'

// Everything a run reads from intelligence/ (README.md, "How a runtime loads it", step 3): the
// pipeline settings, the source registry, the coverage policy, the stage prompts and the JSON
// Schemas every stage answer is checked against.

const readYaml = (file) => yaml.load(readFileSync(file, 'utf8'), { schema: yaml.JSON_SCHEMA })

/** A prompt file's front matter (`stage`, `input`, `output`) and its body. */
export function parsePrompt(text) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n'))
  if (!match) return { meta: {}, body: text }
  return { meta: yaml.load(match[1], { schema: yaml.JSON_SCHEMA }) ?? {}, body: match[2].trim() }
}

/** Loads the folder. Throws when a file is missing or a schema doesn't compile. */
export function loadContract(dir) {
  const pipeline = readYaml(path.join(dir, 'pipeline.yaml'))
  const registry = readYaml(path.join(dir, pipeline.sources ?? 'sources.yaml'))
  const areaFile = pipeline.area ?? 'area.yaml'
  const areaText = readFileSync(path.join(dir, areaFile), 'utf8')
  const area = yaml.load(areaText, { schema: yaml.JSON_SCHEMA })
  // The model stages read the area words with the policy they belong to
  const coverage = `${readFileSync(path.join(dir, pipeline.coverage ?? 'coverage.md'), 'utf8').trimEnd()}

## The area's words (${areaFile})

\`\`\`yaml
${areaText.trim()}
\`\`\`
`

  const ajv = new Ajv2020({ allErrors: true, strict: true })
  const schemas = {}
  const schemaDir = path.join(dir, 'schemas')
  for (const name of readdirSync(schemaDir).filter((n) => n.endsWith('.schema.json'))) {
    const schema = JSON.parse(readFileSync(path.join(schemaDir, name), 'utf8'))
    ajv.addSchema(schema)
    schemas[`schemas/${name}`] = schema
  }

  const prompts = {}
  for (const stage of pipeline.stages ?? []) {
    prompts[stage.id] = parsePrompt(readFileSync(path.join(dir, stage.prompt), 'utf8'))
  }

  /** A validator for one schema file: answers the errors as short strings, empty when valid. */
  function validator(file) {
    const check = ajv.getSchema(schemas[file]?.$id ?? '')
    if (!check) throw new Error(`${file} is missing or doesn't compile`)
    return (value) =>
      check(value) ? [] : (check.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`)
  }

  /** The stage settings from pipeline.yaml. */
  const stage = (id) => {
    const found = (pipeline.stages ?? []).find((s) => s.id === id)
    if (!found) throw new Error(`pipeline.yaml has no stage ${id}`)
    return found
  }

  const areaErrors = validator('schemas/area.schema.json')(area)
  if (areaErrors.length) throw new Error(`${areaFile}: ${areaErrors.join('; ')}`)

  return { dir, pipeline, registry, coverage, area, schemas, prompts, validator, stage }
}

/** The pilot sources, in rank order: only `valid` ones with a pilotRank (scout.md, "Input"). */
export function pilotSources(registry) {
  return (registry.sources ?? [])
    .filter((s) => s.result === 'valid' && Number.isInteger(s.pilotRank))
    .sort((a, b) => a.pilotRank - b.pilotRank)
}
