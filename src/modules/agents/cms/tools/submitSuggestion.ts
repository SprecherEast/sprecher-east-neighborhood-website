import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import {
  APIError,
  type PayloadRequest,
  type RichTextField,
  ValidationError,
  type Where,
} from 'payload'

import { SITE_TIMEZONE } from '@/platform/lib/timezone'
import { collectChartRefusals } from '@/platform/richtext/editorial/chartMarkdown'
import { unreadChartTags } from '@/platform/richtext/editorial/chartTag'

import {
  type CategoryNode,
  MAX_CATEGORY_DEPTH,
  pickDefaultImage,
  toEventSchedule,
  toSuggestionSlug,
} from '../../domain/suggestion'
import { findOwnRun, toToolAnswer } from './runs'
import { submitSuggestionInput, submitSuggestionShape, type SubmitSuggestionInput } from './schemas'

type Outcome = { status: 'created' | 'duplicate'; id: number }

/** The collection's rich-text `content`, in its own editor's nodes, from Markdown. */
function toContent(req: PayloadRequest, input: SubmitSuggestionInput) {
  const field = req.payload.collections[input.collection].config.flattenedFields.find(
    (f): f is RichTextField => f.name === 'content' && f.type === 'richText',
  )
  if (!field) throw new APIError(`${input.collection} has no content field`, 500)
  const editorConfig = editorConfigFactory.fromField({ field })
  // A malformed <Chart> tag is refused with its reasons, so the agent can fix the tag (#640)
  const { value, refusals } = collectChartRefusals(() =>
    convertMarkdownToLexical({ editorConfig, markdown: input.bodyMarkdown }),
  )
  if (refusals.length > 0) throw new APIError(refusals.join(' '), 400, null, true)
  // A tag Payload can't find the end of is dropped with the whole body, and nothing says so
  const unread = unreadChartTags(input.bodyMarkdown, value, refusals)
  if (unread > 0) {
    throw new APIError(
      `${unread} <Chart> tag(s) could not be read, so nothing was stored. Check that every tag ends with /> and that a quote, brace or bracket inside text is written as \\u0022, \\u007b, \\u007d, \\u005b or \\u005d.`,
      400,
      null,
      true,
    )
  }
  return value
}

const idOf = (value: unknown): number | null => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'number') {
    return value.id
  }
  return null
}

/** The categories found by slug, each with its parent and default image. */
async function findCategoryNodes(
  req: PayloadRequest,
  where: Where,
): Promise<(CategoryNode & { slug: string })[]> {
  const { docs } = await req.payload.find({
    collection: 'categories',
    where,
    depth: 0,
    limit: 100,
    pagination: false,
    select: { slug: true, parent: true, defaultImage: true },
    overrideAccess: false,
    user: req.user,
  })
  return docs.map((doc) => ({
    id: doc.id,
    slug: doc.slug,
    parentId: idOf(doc.parent),
    defaultImageId: idOf(doc.defaultImage),
  }))
}

/**
 * The chosen categories' ids, in the agent's order, and the image the suggestion gets (#363): the
 * first category's default image, or its parent's. An unknown slug is refused, never created.
 */
async function resolveCategories(req: PayloadRequest, slugs: readonly string[]) {
  const found = await findCategoryNodes(req, { slug: { in: [...slugs] } })
  const bySlug = new Map(found.map((node) => [node.slug, node]))
  const unknown = slugs.filter((slug) => !bySlug.has(slug))
  if (unknown.length > 0) {
    throw new APIError(`Unknown category: ${unknown.join(', ')}.`, 400, null, true)
  }
  const byId = new Map<number, CategoryNode>(found.map((node) => [node.id, node]))
  // Load the parents, a level at a time, until every chain ends (the rule stops at its depth)
  for (let level = 0; level < MAX_CATEGORY_DEPTH; level++) {
    const missing = [...byId.values()]
      .map((node) => node.parentId)
      .filter((id): id is number => id !== null && !byId.has(id))
    if (missing.length === 0) break
    for (const node of await findCategoryNodes(req, { id: { in: missing } }))
      byId.set(node.id, node)
  }
  const ids = slugs.flatMap((slug) => bySlug.get(slug)?.id ?? [])
  return { ids, imageId: pickDefaultImage(ids, byId) }
}

/**
 * The fields to store: the content, the card text, the categories and their image, the
 * provenance, and for an event its day, times and place.
 */
async function toData(
  req: PayloadRequest,
  input: SubmitSuggestionInput,
): Promise<Record<string, unknown>> {
  const { ids, imageId } = await resolveCategories(req, input.categories)
  const shared = {
    title: input.title,
    slug: toSuggestionSlug(input.title, input.contentHash),
    content: toContent(req, input),
    categories: ids,
    heroImage: imageId,
    _status: 'draft',
    moderationStatus: 'suggested',
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    externalId: input.externalId,
    contentHash: input.contentHash,
    audience: input.audience,
  }
  // Cards show a post's search-engine description and share image, and an event's description
  if (input.collection === 'posts') {
    return { ...shared, meta: { description: input.summary, image: imageId } }
  }
  if (!input.startsAt) throw new APIError('An event needs startsAt.', 400, null, true)
  return {
    ...shared,
    description: input.summary,
    ...toEventSchedule({ ...input, startsAt: input.startsAt }, SITE_TIMEZONE),
    locationName: input.venue || null,
    locationAddress: input.address || null,
  }
}

/**
 * The item already stored with this source ID or fingerprint, if any. Read with access bypassed:
 * suggestions are drafts the agent can't read, and only the id goes back to it.
 */
async function findDuplicate(req: PayloadRequest, input: SubmitSuggestionInput) {
  const { docs } = await req.payload.find({
    collection: input.collection,
    where: {
      or: [
        { externalId: { equals: input.externalId } },
        { contentHash: { equals: input.contentHash } },
      ],
    },
    limit: 1,
    depth: 0,
    select: {},
    overrideAccess: true,
  })
  return docs[0]?.id ?? null
}

const isUniqueRefusal = (error: unknown) =>
  error instanceof ValidationError &&
  error.data.errors.some((e) => e.path === 'externalId' || e.path === 'contentHash')

/**
 * Stores a suggestion as an unpublished draft with status `suggested` and its source, as the
 * agent (its own access applies, and `holdSuggestions` holds it whatever it sends). The same
 * source ID or fingerprint answers `duplicate` with the stored item's id instead of an error.
 * The run's counts are the agent's own to keep in its run log, so this tool doesn't touch them.
 */
export async function submitSuggestion(
  req: PayloadRequest,
  input: SubmitSuggestionInput,
): Promise<Outcome> {
  await findOwnRun(req, input.runId)
  const existing = await findDuplicate(req, input)
  if (existing !== null) return { status: 'duplicate', id: existing }
  try {
    const doc = await req.payload.create({
      collection: input.collection,
      data: await toData(req, input),
      draft: true,
      depth: 0,
      overrideAccess: false,
      user: req.user,
    })
    return { status: 'created', id: doc.id }
  } catch (error) {
    // Another call stored the same item between the check and the create
    const raced = isUniqueRefusal(error) ? await findDuplicate(req, input) : null
    if (raced === null) throw error
    return { status: 'duplicate', id: raced }
  }
}

export const submitSuggestionTool = {
  name: 'submitSuggestion',
  description:
    'Suggest an event or a news post, with its card summary and one or two category slugs from ' +
    'the categories find. It is stored as an unpublished draft for staff to review, never ' +
    'published, with the first category’s default image. Answers {"status":"created","id"} ' +
    'or, when the same externalId or contentHash is already stored, {"status":"duplicate","id"}.',
  parameters: submitSuggestionShape,
  handler: async (args: Record<string, unknown>, req: PayloadRequest) =>
    toToolAnswer(await submitSuggestion(req, submitSuggestionInput.parse(args))),
}
