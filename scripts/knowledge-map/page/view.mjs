/**
 * What the map shows for a given state (#1463): which nodes are visible and which lines join them.
 * A node is shown when every container above it is expanded and no filter hides it. A line to a
 * node that is not shown is drawn to the nearest shown container instead, and lines that now join
 * the same two nodes in the same layer merge into one heavier line. Pure.
 */
import { ancestors, moduleOf } from './model.mjs'

/** The state a reader starts from: the overview (the root, opened once), nothing hidden. */
export const initialState = (model) => ({
  expanded: new Set(model.root ? [model.root] : []),
  hiddenLayers: new Set(),
  hiddenTypes: new Set(),
  hiddenModules: new Set(),
  solo: null,
})

/** The layers switched on when the page opens; every other layer starts off, to be switched on. */
export const INITIAL_LAYERS = ['structure', 'code', 'data']

/** The state the page opens with: the overview, and only the layers named in `INITIAL_LAYERS`. */
export const startState = (model) => ({
  ...initialState(model),
  hiddenLayers: new Set(
    model.graph.layers.map((layer) => layer.key).filter((key) => !INITIAL_LAYERS.includes(key)),
  ),
})

/** Whether a filter alone hides this node (not counting collapsed containers). */
function filteredOut(model, state, id) {
  const node = model.nodes.get(id)
  if (id === model.root) return false
  if (state.hiddenTypes.has(node.type)) return true
  const module = moduleOf(model, id)
  if (state.solo !== null) return module !== state.solo
  return module !== null && state.hiddenModules.has(module)
}

/** `{ ids, shown, anchor, edges }`; `anchor(id)` is the shown node standing for `id`, or null. */
export function computeView(model, state) {
  const shown = new Set()
  const walk = (id) => {
    if (!filteredOut(model, state, id)) shown.add(id)
    if (!state.expanded.has(id)) return
    for (const child of model.children.get(id)) walk(child)
  }
  if (model.root) walk(model.root)

  const anchor = (id) => {
    if (shown.has(id)) return id
    for (const up of ancestors(model, id)) if (shown.has(up)) return up
    return null
  }
  // A node is only reachable through expanded containers, so a hidden one maps to its container.
  const reaches = (id) => ancestors(model, id).every((up) => state.expanded.has(up))
  const stands = (id) => (shown.has(id) ? id : reaches(id) ? null : anchor(id))

  const edges = new Map()
  const add = (from, to, layer, type, count) => {
    if (from === null || to === null || from === to) return
    const key = `${from}\u0000${to}\u0000${layer}`
    const line = edges.get(key) ?? {
      id: key,
      from,
      to,
      layer,
      types: {},
      count: 0,
      structure: false,
    }
    line.count += count
    line.types[type] = (line.types[type] ?? 0) + count
    edges.set(key, line)
  }
  if (!state.hiddenLayers.has('structure')) {
    for (const id of shown) {
      if (id === model.root) continue
      const up = ancestors(model, id).find((a) => shown.has(a))
      if (up !== undefined) {
        add(up, id, 'structure', 'contains', 1)
        edges.get(`${up}\u0000${id}\u0000structure`).structure = true
      }
    }
  }
  for (const edge of model.graph.edges) {
    if (edge.type === 'contains' || state.hiddenLayers.has(edge.layer)) continue
    add(stands(edge.from), stands(edge.to), edge.layer, edge.type, edge.count ?? 1)
  }
  return { ids: [...shown], shown, anchor, edges: [...edges.values()] }
}

/** Opens every container above `id`, so it is shown (unless a filter hides it). */
export function reveal(model, state, id) {
  const expanded = new Set(state.expanded)
  for (const up of ancestors(model, id)) expanded.add(up)
  return { ...state, expanded }
}

/** Expands or collapses one node; a collapsed node's own descendants stay as they were. */
export function toggle(state, id) {
  const expanded = new Set(state.expanded)
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
  return { ...state, expanded }
}

/** Opens every node that has children. */
export const expandAll = (model, state) => ({
  ...state,
  expanded: new Set([...model.children].filter(([, kids]) => kids.length > 0).map(([id]) => id)),
})

/** Back to the overview. */
export const collapseAll = (model, state) => ({ ...state, expanded: initialState(model).expanded })

/** Adds or removes `value` in one of the state's sets, returning a new state. */
export function flip(state, key, value) {
  const set = new Set(state[key])
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return { ...state, [key]: set }
}
