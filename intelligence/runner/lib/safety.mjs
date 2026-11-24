// What counts as a safety item (#1007), as the gate decides it. The definition of what makes an
// item a safety item is `safety.yaml`, a principle the model stages apply by meaning; this file
// reads no item text. An item is clear only when its source is known, matches the candidate and
// isn't on the always-held list, and verify and curate both answered a plain `false`. Anything
// else is held: a source on the list, an answer of `true`, an answer that isn't a boolean, no
// answer, or an item that can't be read.

export const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The rules the gate uses from safety.yaml (already checked against schemas/safety.schema.json). */
export const safetyRules = (definition) => ({ sources: new Set(definition?.sources ?? []) })

/** The safety sources `definition` lists that `registry` doesn't hold: the one check for the runner and the script. */
export const unregisteredSafetySources = (definition, registry) => {
  const registered = new Set((registry?.sources ?? []).map((source) => source.id))
  return (definition?.sources ?? []).filter((id) => !registered.has(id))
}

/** Why the source can't clear the item: it must be known, match the candidate, and not be listed. */
function sourceProblems(rules, { candidate, source }) {
  // A listed `alsoReportedBy` that isn't a list throws here, and `classifySafety` holds the item
  const also = candidate.alsoReportedBy ?? []
  const ids = [candidate.sourceId, source?.id, ...also.map((other) => other?.sourceId)]
  if (!isObject(source) || source.id !== candidate.sourceId)
    return ['the source facts are missing or don’t match']
  if (ids.some((id) => typeof id !== 'string')) return ['a source id is missing']
  return ids.some((id) => rules.sources.has(id)) ? ['the source is a safety source'] : []
}

/** Why the stages' answers don't clear the item: any answer but a plain `false` counts. */
function stageProblems({ verification, curation }) {
  return [
    ['verify', verification],
    ['curate', curation],
  ].flatMap(([stage, section]) => {
    if (!isObject(section) || section.safety === undefined)
      return [`${stage} gave no safety answer`]
    if (section.safety === true) return [`${stage} says safety`]
    return section.safety === false ? [] : [`${stage}’s safety answer is not a boolean`]
  })
}

function classify(rules, item) {
  const why = stageProblems(item)
  if (!rules || !(rules.sources instanceof Set)) why.push('the definition is missing')
  else why.push(...sourceProblems(rules, item))
  return { safety: why.length > 0, why }
}

/**
 * Whether `item` is a safety item. Answers `{ safety, why }`: `why` is fixed phrases, never the
 * item's own words. Anything unreadable or missing is safety.
 */
export function classifySafety(rules, item) {
  if (!isObject(item) || !isObject(item.candidate))
    return { safety: true, why: ['the item can’t be read'] }
  try {
    return classify(rules, item)
  } catch {
    return { safety: true, why: ['the item can’t be read'] }
  }
}
