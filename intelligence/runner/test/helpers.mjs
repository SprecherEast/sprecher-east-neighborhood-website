import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'

import { loadContract } from '../lib/contract.mjs'

export const intelligenceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const contract = loadContract(intelligenceDir)

/** The contract for a run on a fixed day: the boundary copy is dated that day, never in its future. */
export const contractOn = (day) => ({
  ...contract,
  boundary: { ...contract.boundary, fetchedAt: day },
})

/** One evals file's cases. */
export const evalCases = (stage) =>
  yaml.load(readFileSync(path.join(intelligenceDir, 'evals', `${stage}.yaml`), 'utf8'), {
    schema: yaml.JSON_SCHEMA,
  })

/**
 * A `fetch` double that answers `responses` in order (the evals' shape: status, contentType,
 * redirectTo, body), and records each requested URL.
 */
export function fakeHttp(responses) {
  const queue = [...responses]
  const requested = []
  const http = async (url) => {
    requested.push(url)
    const next = queue.shift()
    if (!next) throw new Error(`no more fake responses for ${url}`)
    const headers = new Headers()
    if (next.contentType) headers.set('content-type', next.contentType)
    if (next.redirectTo) headers.set('location', next.redirectTo)
    if (next.etag) headers.set('etag', next.etag)
    return new Response(
      next.status === 304 || (next.status >= 300 && next.status < 400) ? null : (next.body ?? ''),
      {
        status: next.status,
        headers,
      },
    )
  }
  return Object.assign(http, { requested })
}

/** The value at `$.a.b` or `$.list[].field` (every element's field). */
export function valueAt(object, field) {
  let values = [object]
  for (const part of field.replace(/^\$\./, '').split('.')) {
    const many = part.endsWith('[]')
    const key = many ? part.slice(0, -2) : part
    values = values.flatMap((v) => {
      const next = v?.[key]
      return many ? (Array.isArray(next) ? next : []) : [next]
    })
  }
  return field.includes('[]') ? values : values[0]
}

/** A grader from the evals (eval-parts.schema.json), applied to `output`. Model graders: null. */
export function grade(grader, output) {
  if (grader.check === 'model') return null
  const value = valueAt(output, grader.field)
  const asText = Array.isArray(value) ? value : String(value ?? '')
  switch (grader.check) {
    case 'equals':
      return value === grader.value
    case 'isNull':
      return value === null || value === undefined
    case 'present':
      return value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)
    case 'contains':
      return asText.includes(grader.value)
    case 'notContains':
      return !asText.includes(grader.value)
    case 'notMatches':
      return !new RegExp(grader.value).test(String(value ?? ''))
    case 'lessThan':
      return Number(value) < Number(grader.value)
    default:
      throw new Error(`unknown check ${grader.check}`)
  }
}

/** A noon instant in Chicago on the evals' `asOf` day. */
export const atNoon = (date) => new Date(`${date}T17:00:00Z`)

export const budgets = contract.pipeline.budgets
