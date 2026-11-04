import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'

import { AUDIENCES, TITLE_MAX_LENGTH } from '@/platform/lib'

import { FETCH_USED, RUN_STATUSES, SOURCE_CHECK_STATUSES } from '../../domain/runs'
import { REVIEW_FLAGS, REVIEW_ITEM_KINDS } from '../../domain/suggestion'
import { AgentRuns } from '../agentRuns'
import { reportItemInput, submitSuggestionInput } from './schemas'

/**
 * The tools' Zod schemas against the agents' contract in `intelligence/schemas/` (#344, #355):
 * every sample, including the submit evals' items, gets the same verdict from both, and the lists
 * of values match, so the two can't drift apart silently.
 */

const root = path.resolve(__dirname, '../../../../..')
const schemaDir = path.join(root, 'intelligence/schemas')
// js-yaml comes with eslint and has no types here; JSON_SCHEMA keeps dates as strings
const yaml = createRequire(import.meta.url)('js-yaml') as {
  load: (text: string, options: { schema: unknown }) => unknown
  JSON_SCHEMA: unknown
}

const ajv = new Ajv2020({ allErrors: true, strict: true })
const schemas: Record<string, { $id: string } & Record<string, unknown>> = {}
for (const name of readdirSync(schemaDir).filter((n) => n.endsWith('.schema.json'))) {
  const schema = JSON.parse(readFileSync(path.join(schemaDir, name), 'utf8'))
  ajv.addSchema(schema)
  schemas[name] = schema
}
const validator = (name: string) => {
  const check = ajv.getSchema(schemas[name].$id)
  if (!check) throw new Error(`${name} doesn't compile`)
  return (value: unknown) => check(value) === true
}
const suggestionValid = validator('suggestion.schema.json')
const reportValid = validator('report.schema.json')
const defs = (schemas['common.schema.json'].$defs ?? {}) as Record<string, { enum: string[] }>
const runSchema = schemas['agent-run.schema.json'] as unknown as {
  properties: Record<string, { items?: { properties: Record<string, { enum?: string[] }> } }> & {
    status: { enum: string[] }
    counts: { properties: Record<string, unknown> }
  }
}

const SUGGESTION = {
  collection: 'events',
  title: 'Silent Book Club at Pinney Library',
  bodyMarkdown: 'Bring a book and read together.',
  summary: 'A quiet hour of reading with neighbors. Free.',
  categories: ['community'],
  startsAt: '2026-11-17T19:00:00-06:00',
  endsAt: null,
  allDay: false,
  venue: 'Pinney Library',
  address: null,
  sourceName: 'Madison Public Library',
  sourceUrl: 'https://www.madisonpubliclibrary.org/events/1',
  externalId: 'mpl-pinney-events:f893db74',
  contentHash: 'e'.repeat(64),
  audience: ['everyone'],
  runId: 'scout-2026-10-24',
}
const REPORT = {
  runId: 'scout-2026-10-24',
  kind: 'needs-review',
  targetCollection: null,
  targetId: null,
  externalId: null,
  summary: 'Check the date.',
  evidence: [{ url: 'https://e.com/a', says: 'Nov 17', retrievedAt: '2026-10-24T10:00:00Z' }],
  flags: ['needs-date', 'wrong-offset'],
  sourceUrl: 'https://e.com/a',
}
const long = (n: number) => 'x'.repeat(n + 1)

/** The submit evals' items that become a suggestion, as the submit stage builds its arguments. */
function evalSuggestions(): Record<string, unknown>[] {
  const file = path.join(root, 'intelligence/evals/submit.yaml')
  const { cases } = yaml.load(readFileSync(file, 'utf8'), { schema: yaml.JSON_SCHEMA }) as {
    cases: {
      expected: { route: string }
      input: Record<string, string>
      given: { draft?: object }
    }[]
  }
  return cases
    .filter((c) => c.expected.route === 'submitSuggestion' && c.given.draft)
    .map(({ input, given }) => ({
      ...SUGGESTION,
      ...given.draft,
      startsAt: input.startsAt,
      externalId: input.externalId,
      contentHash: input.contentHash,
    }))
}

describe('submitSuggestion arguments', () => {
  const samples: [string, Record<string, unknown>][] = [
    ['a full event', SUGGESTION],
    ['a post', { ...SUGGESTION, collection: 'posts', startsAt: null, allDay: null, venue: null }],
    ...evalSuggestions().map((s, i): [string, Record<string, unknown>] => [`eval item ${i}`, s]),
    ['a long title', { ...SUGGESTION, title: long(TITLE_MAX_LENGTH) }],
    ['a long body', { ...SUGGESTION, bodyMarkdown: long(12_000) }],
    ['a body at the cap', { ...SUGGESTION, bodyMarkdown: 'x'.repeat(12_000) }],
    ['a long venue', { ...SUGGESTION, venue: long(200) }],
    ['a long address', { ...SUGGESTION, address: long(300) }],
    ['a long source name', { ...SUGGESTION, sourceName: long(200) }],
    ['a long link', { ...SUGGESTION, sourceUrl: `https://e.com/${long(2_048)}` }],
    ['a long external id', { ...SUGGESTION, externalId: `mpl:${long(200)}` }],
    ['an external id without a source', { ...SUGGESTION, externalId: 'f893db74' }],
    ['a hash in capitals', { ...SUGGESTION, contentHash: 'E'.repeat(64) }],
    ['a long run id', { ...SUGGESTION, runId: long(100) }],
    ['a repeated audience', { ...SUGGESTION, audience: ['everyone', 'everyone'] }],
    ['an unknown audience', { ...SUGGESTION, audience: ['kids'] }],
    ['a day without a time', { ...SUGGESTION, startsAt: '2026-11-17' }],
    ['no title', { ...SUGGESTION, title: undefined }],
    ['a long summary', { ...SUGGESTION, summary: long(160) }],
    ['no summary', { ...SUGGESTION, summary: undefined }],
    ['no category', { ...SUGGESTION, categories: [] }],
    ['three categories', { ...SUGGESTION, categories: ['parks', 'social', 'community'] }],
    ['a subcategory and its parent', { ...SUGGESTION, categories: ['nature-walks', 'parks'] }],
    ['a repeated category', { ...SUGGESTION, categories: ['parks', 'parks'] }],
    ['a category that isn’t a slug', { ...SUGGESTION, categories: ['Parks & Rec'] }],
    ['a long category slug', { ...SUGGESTION, categories: [`p${'-a'.repeat(50)}`] }],
    // What Payload's slug field makes of "Sports & Recreation" and "Kids_Club"
    ['slugs Payload makes', { ...SUGGESTION, categories: ['sports--recreation', 'kids_club'] }],
  ]

  it('found the evals’ suggestions', () => {
    expect(evalSuggestions().length).toBeGreaterThan(0)
  })

  it.each(samples)('get the same verdict for %s', (_, sample) => {
    expect(submitSuggestionInput.safeParse(sample).success).toBe(suggestionValid(sample))
  })
})

describe('reportItem arguments', () => {
  const evidence = REPORT.evidence[0]
  const samples: [string, Record<string, unknown>][] = [
    ['a needs-review report', REPORT],
    [
      'a cancellation',
      { ...REPORT, kind: 'cancel', targetCollection: 'events', targetId: 4, flags: [] },
    ],
    ['a rejection without a link', { ...REPORT, kind: 'rejected-invalid', sourceUrl: null }],
    ['a review without a link', { ...REPORT, sourceUrl: null }],
    ['a cancellation without a target', { ...REPORT, kind: 'cancel' }],
    ['a target id without a collection', { ...REPORT, targetId: 4 }],
    ['a target id that is text', { ...REPORT, targetCollection: 'events', targetId: '4' }],
    ['a long summary', { ...REPORT, summary: long(1_000) }],
    ['six evidence items', { ...REPORT, evidence: Array(6).fill(evidence) }],
    ['long evidence', { ...REPORT, evidence: [{ ...evidence, says: long(500) }] }],
    ['an unknown flag', { ...REPORT, flags: ['urgent'] }],
    ['a repeated flag', { ...REPORT, flags: ['past', 'past'] }],
    ['an external id without a source', { ...REPORT, externalId: '29400' }],
    [
      // The submit stage's image-candidate report at the longest image link and credit (#363)
      'the longest image-candidate report',
      {
        ...REPORT,
        flags: ['image-candidate'],
        evidence: [
          {
            ...evidence,
            says: `https://e.com/${'x'.repeat(266)} — credit: ${'c'.repeat(200)}`,
          },
        ],
      },
    ],
  ]

  it.each(samples)('get the same verdict for %s', (_, sample) => {
    expect(reportItemInput.safeParse(sample).success).toBe(reportValid(sample))
  })

  it('fit the longest image candidate in one evidence line', () => {
    const longest = samples.find(([name]) => name === 'the longest image-candidate report')
    expect(longest && reportValid(longest[1])).toBe(true)
  })
})

describe('the lists of values', () => {
  const values = (options: readonly { value: string }[]) => options.map((o) => o.value)

  it('match the contract', () => {
    expect([...REVIEW_FLAGS].sort()).toEqual([...defs.flag.enum].sort())
    expect(values(AUDIENCES).sort()).toEqual([...defs.audience.enum].sort())
    const report = schemas['report.schema.json'] as unknown as {
      properties: { kind: { enum: string[] } }
    }
    expect(values(REVIEW_ITEM_KINDS)).toEqual(report.properties.kind.enum)
    expect([...FETCH_USED]).toEqual(defs.fetchUsed.enum)
    expect([...RUN_STATUSES]).toEqual(runSchema.properties.status.enum)
    const checked = runSchema.properties.sourcesChecked.items?.properties ?? {}
    expect([...SOURCE_CHECK_STATUSES]).toEqual(checked.status.enum)
  })

  it('name the same run fields as the agent-runs collection', () => {
    const named = (fields: unknown[]) =>
      fields.flatMap((f) => (f && typeof f === 'object' && 'name' in f ? [String(f.name)] : []))
    const field = (name: string) =>
      AgentRuns.fields.find((f) => 'name' in f && f.name === name) as { fields: unknown[] }
    // `agent` and `reviewItems` are the site's own, on top of the contract
    const own = named(AgentRuns.fields).filter((n) => !['agent', 'reviewItems'].includes(n))
    expect(own.sort()).toEqual(Object.keys(runSchema.properties).sort())
    expect(named(field('sourcesChecked').fields).sort()).toEqual(Object.keys(checked()).sort())
    expect(named(field('counts').fields).sort()).toEqual(
      Object.keys(runSchema.properties.counts.properties).sort(),
    )
  })
})

const checked = () => runSchema.properties.sourcesChecked.items?.properties ?? {}
