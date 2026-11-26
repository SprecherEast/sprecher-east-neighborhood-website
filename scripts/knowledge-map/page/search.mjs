/**
 * Search (#1463): finds a node by name, alias, path, route, field name, content type or endpoint,
 * and says which of them matched. Pure. A name match ranks above an alias, a path or a field.
 */

const FIELDS = [
  ['name', 0, (node) => [node.name]],
  ['alias', 1, (node) => node.aliases ?? []],
  ['id', 2, (node) => [node.id]],
  ['path', 3, (node) => [node.path]],
  ['type', 4, (node) => [node.type]],
  ['field', 5, (node) => (node.fields ?? []).map((field) => field.name)],
  ['summary', 6, (node) => [node.summary]],
]

const norm = (text) => String(text ?? '').toLowerCase()

/** The best rank of one node for the words, or null when a word matches nowhere. */
function rankNode(node, words) {
  let total = 0
  let why = ''
  for (const word of words) {
    let best = null
    for (const [label, weight, read] of FIELDS) {
      for (const value of read(node)) {
        const text = norm(value)
        const at = text.indexOf(word)
        if (at < 0) continue
        // An exact or leading match beats one in the middle; a heavier field ranks lower.
        const score = weight * 10 + (text === word ? 0 : at === 0 ? 2 : 5)
        if (best === null || score < best.score) best = { score, label, value }
      }
    }
    if (best === null) return null
    total += best.score
    if (why === '')
      why = ['name', 'id', 'type'].includes(best.label) ? '' : `${best.label}: ${best.value}`
  }
  return { score: total, why }
}

/** `[{ id, why }]`, best first, at most `limit`; an empty query gives nothing. */
export function searchNodes(model, query, limit = 30) {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const found = []
  for (const node of model.graph.nodes) {
    const rank = rankNode(node, words)
    if (rank !== null)
      found.push({ id: node.id, why: rank.why, score: rank.score, name: norm(node.name) })
  }
  found.sort((a, b) => a.score - b.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return found.slice(0, limit).map(({ id, why }) => ({ id, why }))
}
