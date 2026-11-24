import { fetchDirect } from './fetchSource.mjs'
import { parserFor } from './parsers.mjs'
import { changeOf } from './state.mjs'
import { contentHash, matchKey } from './text.mjs'
import { addDays, dateIn, isoNow } from './time.mjs'

// Scout (scout.md): fetch each pilot source, parse it, and build candidates with a stable
// externalId, a contentHash and the change since earlier runs. Code only, no model.

const escape = (word) => word.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const wordsPattern = (words) =>
  new RegExp(`(?<![a-z0-9])(?:${words.map(escape).join('|')})(?![a-z0-9])`, 'i')

/**
 * Whether a text names the area, by area.yaml (#390): a place in or bounding it, a neighboring
 * association, or a highway together with an interchange or a cross street at the area's edge.
 * For the sources whose treatment says to match text on our side (Legistar). The model stages
 * still decide; this only keeps routine citywide meetings and legislation from using the run's
 * model budget.
 */
export function areaMatcher(area) {
  const local = wordsPattern([...area.places, ...area.neighbors.names])
  const highways = area.highways.map(({ names, with: near }) => [
    wordsPattern(names),
    wordsPattern(near),
  ])
  return (text) =>
    local.test(text) || highways.some(([road, near]) => road.test(text) && near.test(text))
}

/** The per-source rules from sources.yaml `treatment` that code can apply. */
export function keepItem(source, item, namesArea) {
  const text = `${item.title} ${item.sourceText} ${item.locationText ?? ''}`
  if (source.id === 'legistar-events') {
    return /common council/i.test(item.title) || /public hearing/i.test(text) || namesArea(text)
  }
  if (source.id === 'legistar-matters') return namesArea(text)
  // City news is citywide: only releases that name the area use the run's model budget (#390)
  if (source.id === 'city-news') return namesArea(text)
  // WisDOT's page also lists meetings on other roads (US 12 in Juneau County): a meeting that
  // names another road and neither the corridor nor the area stays out; the rest go on (#390)
  if (source.id === 'wisdot-i39-90-94') {
    const otherRoad = /\b(?:US|USH|WIS|STH|CTH|County|Highway)\s+[A-Z0-9]{1,3}\b/.test(text)
    const corridor = /\bI-?(?:39|90|94)\b|\binterstate\b|\bcorridor\b|\binterchange\b/i.test(text)
    return !otherRoad || corridor || namesArea(text)
  }
  return true
}

/** The source's URL with `{from}`, `{to}` and `{cursor}` filled in (scout.md step 1). */
export function sourceUrl(source, { today, cursor }) {
  const template = source.feedUrl ?? source.canonicalUrl
  return template
    .replaceAll('{from}', today)
    .replaceAll('{to}', addDays(today, 14))
    .replaceAll('{cursor}', cursor ?? `${addDays(today, -7)}T00:00:00`)
}

/** The newest modification time among the items: the next cursor for a cursor source. */
const newestModified = (items) =>
  items
    .map((i) => i.modified)
    .filter((m) => typeof m === 'string' && /^\d{4}-/.test(m))
    .sort()
    .at(-1) ?? null

/**
 * Scouts one source. Answers its run-log entry (`check`), its candidates, the candidates that
 * failed the schema, and the fetch state to save once its items are all handled.
 */
export async function scoutSource(
  source,
  { state, http, robots, budgets, validate, area, now = new Date() },
) {
  const namesArea = areaMatcher(area)
  const check = {
    sourceId: source.id,
    fetchStrategy: 'none',
    cursor: null,
    status: 'skipped',
    error: null,
  }
  const saved = state.sources[source.id] ?? {}
  if (source.cadence === 'none') return { check, candidates: [], invalid: [] }
  const today = dateIn(now)
  const url = sourceUrl(source, { today, cursor: saved.cursor })
  check.fetchStrategy = 'direct'
  const answer = await fetchDirect(url, {
    http,
    robots,
    etag: saved.etag,
    lastModified: saved.lastModified,
  })
  check.status = answer.status
  check.error = answer.error ? String(answer.error).slice(0, 500) : null
  check.cursor = saved.cursor ?? null
  if (answer.status !== 'ok') return { check, candidates: [], invalid: [] }
  const parse = parserFor(source)
  if (!parse) {
    check.status = 'skipped'
    check.error = `no parser for ${source.format} yet (#364)`
    return { check, candidates: [], invalid: [] }
  }

  const host = new URL(source.canonicalUrl).hostname.replace(/^www\./, '')
  let items
  try {
    // `base` resolves an HTML page's relative links (#390)
    items = parse(answer.body, { from: today, host, base: source.canonicalUrl }).filter((item) =>
      keepItem(source, item, namesArea),
    )
  } catch (error) {
    check.status = 'error'
    check.error = `parse failed: ${error.message}`.slice(0, 500)
    return { check, candidates: [], invalid: [] }
  }
  // A cursor source keeps its oldest changes first and moves its cursor only past those, so the
  // rest come back next run; any other source keeps its soonest events and reports the rest as
  // over the cap, so its ETag isn't saved and they come back too (scout.md step 7)
  const cursorSource = Boolean(source.feedUrl?.includes('{cursor}'))
  const ordered = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) =>
      cursorSource
        ? String(a.item.modified ?? '').localeCompare(String(b.item.modified ?? ''))
        : (a.item.startsAt ?? '\uffff').localeCompare(b.item.startsAt ?? '\uffff') ||
          a.index - b.index,
    )
    .map(({ item }) => item)
  // The cap counts new and changed items only: unchanged ones cost nothing downstream
  const retrievedAt = isoNow(now)
  const candidates = []
  const invalid = []
  const included = []
  let changedKept = 0
  let overCap = 0
  for (const item of ordered) {
    const fields = {
      title: item.title,
      sourceText: item.sourceText,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      allDay: item.allDay,
      locationText: item.locationText,
      sourceStatus: item.sourceStatus,
    }
    const hash = contentHash(fields)
    const externalId = `${source.id}:${item.ownId}`.slice(0, 200)
    const change = changeOf(state, externalId, hash)
    if (change !== 'unchanged' && changedKept >= budgets.maxItemsPerSource) {
      overCap++
      // A cursor source stops here, so its cursor never passes an item it didn't take
      if (cursorSource) break
      continue
    }
    if (change !== 'unchanged') changedKept++
    included.push(item)
    const candidate = {
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: item.url ?? source.canonicalUrl,
      externalId,
      contentHash: hash,
      retrievedAt,
      kind: item.kind,
      ...fields,
      change,
    }
    // Unchanged items are dropped after the cross-source merge, so a lower-ranked copy of an
    // item already handled can't come through as new (mergeAcrossSources)
    const errors = change === 'unchanged' ? [] : validate(candidate)
    if (errors.length > 0) invalid.push({ candidate, errors })
    else candidates.push(candidate)
  }
  const nextCursor = cursorSource ? newestModified(included) : null
  if (nextCursor) check.cursor = nextCursor
  const deferred = cursorSource ? 0 : overCap
  const fetchState = {
    etag: answer.etag,
    lastModified: answer.lastModified,
    cursor: nextCursor ?? saved.cursor ?? null,
  }
  return { check, candidates, invalid, fetchState, deferred }
}

/** The copies merged into `candidate` from lower-ranked sources (not part of its JSON). */
export function mergedCopies(candidate) {
  if (!Object.hasOwn(candidate, 'mergedCopies')) {
    Object.defineProperty(candidate, 'mergedCopies', { value: [], enumerable: false })
  }
  return candidate.mergedCopies
}

/**
 * Same item from two pilot sources (scout.md step 6): one candidate from the higher-ranked
 * source, the others listed in `alsoReportedBy`. `bySource` is in rank order.
 */
export function mergeAcrossSources(bySource) {
  const kept = new Map()
  const out = []
  for (const candidates of bySource) {
    for (const candidate of candidates) {
      const key = candidate.startsAt ? matchKey(candidate) : null
      const first = key ? kept.get(key) : undefined
      if (first && first.sourceId !== candidate.sourceId) {
        first.alsoReportedBy = [
          ...(first.alsoReportedBy ?? []),
          {
            sourceId: candidate.sourceId,
            sourceUrl: candidate.sourceUrl,
            externalId: candidate.externalId,
          },
        ].slice(0, 5)
        // The copies it absorbed, kept out of the item's JSON: they're marked handled with it,
        // and their sources' checkpoints wait with its own when it's deferred
        mergedCopies(first).push({
          sourceId: candidate.sourceId,
          externalId: candidate.externalId,
          contentHash: candidate.contentHash,
        })
        continue
      }
      if (key) kept.set(key, candidate)
      out.push(candidate)
    }
  }
  return out
}
