/**
 * The shortest route between two nodes (#1463): the fewest steps along connections of the layers
 * that are switched on, in either direction, and along the containment tree. Pure.
 */

/** `[ids]` from `from` to `to`, or null when no route exists. */
export function shortestPath(model, state, from, to) {
  if (!model.nodes.has(from) || !model.nodes.has(to)) return null
  if (from === to) return [from]
  const before = new Map([[from, null]])
  const queue = [from]
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head]
    const next = []
    for (const link of model.links.get(id)) {
      if (!state.hiddenLayers.has(model.graph.edges[link.index].layer)) next.push(link.other)
    }
    if (!state.hiddenLayers.has('structure')) {
      const up = model.parent.get(id)
      if (up !== undefined) next.push(up)
      next.push(...model.children.get(id))
    }
    for (const other of next) {
      if (before.has(other)) continue
      before.set(other, id)
      if (other === to) {
        const route = [to]
        for (let at = id; at !== null; at = before.get(at)) route.unshift(at)
        return route
      }
      queue.push(other)
    }
  }
  return null
}
