import { z } from 'zod'

import { AUDIENCES, type Audience } from '@/platform/lib'

import {
  CATEGORY_SLUG,
  CONTENT_HASH,
  DATE_TIME,
  EXTERNAL_ID,
  HTTP_URL,
  REVIEW_FLAGS,
  REVIEW_ITEM_KINDS,
  type ReviewItemKind,
  SUGGESTION_CAPS as CAPS,
  SUGGESTION_COLLECTIONS,
} from '../../domain/suggestion'

/**
 * The arguments of the agents' two MCP tools (#336), as `intelligence/schemas/suggestion.schema.json`
 * and `report.schema.json` define them (#344), with a size cap on every one. The MCP server checks
 * them before the handler runs; the handler parses them again, with the cross-field rules.
 */

const text = (max: number) => z.string().trim().min(1).max(max)
const optional = <T extends z.ZodType>(schema: T) => schema.nullable().optional()
const webAddress = z.string().max(CAPS.sourceUrl).regex(HTTP_URL)
const dateTime = z.string().regex(DATE_TIME)
const externalId = z.string().max(CAPS.externalId).regex(EXTERNAL_ID)
const values = <T extends string>(options: readonly { value: T }[]) =>
  options.map((option) => option.value) as [T, ...T[]]
const unique = <T>(items: T[]) => new Set(items).size === items.length
const isSet = (value: unknown) => value !== null && value !== undefined
const runId = text(CAPS.runId).describe('The runId of your current run in agent-runs.')

export const submitSuggestionShape = {
  collection: z.enum(SUGGESTION_COLLECTIONS).describe('Where it goes: an event or a news post.'),
  title: text(CAPS.title),
  bodyMarkdown: text(CAPS.bodyMarkdown).describe(
    'The full text, in Markdown. A <Chart … /> tag adds a chart; a malformed one is refused with the reason.',
  ),
  summary: text(CAPS.cardSummary).describe(
    'The card text: one or two plain sentences, no Markdown or links.',
  ),
  categories: z
    .array(z.string().max(CAPS.categorySlug).regex(CATEGORY_SLUG))
    .min(1)
    .max(CAPS.categories)
    .refine(unique, 'Each category once')
    .describe('One or two category slugs from the categories find, most specific first.'),
  startsAt: optional(dateTime).describe('Events: required, a date-time with a zone.'),
  endsAt: optional(dateTime),
  allDay: optional(z.boolean()),
  venue: optional(text(CAPS.venue)),
  address: optional(text(CAPS.address)),
  sourceName: text(CAPS.sourceName),
  sourceUrl: webAddress,
  externalId: externalId.describe('The source id, a colon, the source’s own id.'),
  contentHash: z.string().regex(CONTENT_HASH).describe('sha256 of the item, lowercase hex.'),
  audience: z
    .array(z.enum(values<Audience>(AUDIENCES)))
    .max(AUDIENCES.length)
    .refine(unique, 'Each audience once'),
  runId,
}

const evidence = z.object({
  url: webAddress,
  says: text(CAPS.evidenceSays),
  retrievedAt: dateTime,
})

export const reportItemShape = {
  runId,
  kind: z.enum(values<ReviewItemKind>(REVIEW_ITEM_KINDS)),
  targetCollection: optional(z.enum(SUGGESTION_COLLECTIONS)),
  targetId: optional(z.number().int().min(1)).describe(
    'With targetCollection: ids are per collection.',
  ),
  externalId: optional(externalId),
  summary: text(CAPS.summary).describe('What an editor should know or do, in a few sentences.'),
  evidence: z.array(evidence).max(CAPS.evidenceItems),
  flags: z.array(z.enum(REVIEW_FLAGS)).max(CAPS.flags).refine(unique, 'Each flag once'),
  sourceUrl: webAddress.nullable().describe('Null only for rejected-invalid with no source link.'),
}

export const submitSuggestionInput = z
  .object(submitSuggestionShape)
  .strict()
  .refine((s) => s.collection !== 'events' || Boolean(s.startsAt), {
    message: 'An event needs startsAt',
    path: ['startsAt'],
  })

export const reportItemInput = z
  .object(reportItemShape)
  .strict()
  .refine((r) => !isSet(r.targetId) || isSet(r.targetCollection), {
    message: 'targetCollection is required with targetId',
    path: ['targetCollection'],
  })
  .refine((r) => !['update', 'cancel'].includes(r.kind) || isSet(r.targetId), {
    message: 'An update or a cancellation names its targetId',
    path: ['targetId'],
  })
  .refine((r) => r.kind === 'rejected-invalid' || isSet(r.sourceUrl), {
    message: 'Only a rejected-invalid report may have no sourceUrl',
    path: ['sourceUrl'],
  })

export type SubmitSuggestionInput = z.infer<typeof submitSuggestionInput>
export type ReportItemInput = z.infer<typeof reportItemInput>
