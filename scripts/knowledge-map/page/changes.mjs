/**
 * What changed (#1463): the nodes touched by the commits made after an earlier build, read from the
 * change history the scanner writes (`.knowledge-map/history.json`). Pure.
 */

/** The commits a reader can pick as "since", newest first. */
export const choices = (history) => (history?.available ? history.commits : [])

/**
 * `{ ids: Set, list: [{ id, sha, date, subject }] }` for the commits newer than `sinceSha`
 * (the history is newest first). An unknown commit gives every listed commit.
 */
export function changedSince(history, sinceSha) {
  const ids = new Set()
  const list = []
  if (!history?.available) return { ids, list }
  for (const commit of history.commits) {
    if (commit.sha === sinceSha) break
    for (const id of commit.nodes) {
      if (ids.has(id)) continue
      ids.add(id)
      list.push({ id, sha: commit.sha, date: commit.date, subject: commit.subject })
    }
  }
  return { ids, list }
}
