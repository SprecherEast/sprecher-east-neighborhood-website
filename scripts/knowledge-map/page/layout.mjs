/**
 * The two layouts (#1463). Free: a physics-style settle where nodes push apart, lines pull their
 * ends together and each top-level part drifts to its own region. Mind map: the tree fans out from
 * the root. Pure: positions are plain numbers, and nothing here reads the clock or the screen.
 */
import { ancestors } from './model.mjs'

const TAU = Math.PI * 2

/** A number between 0 and 1 from a string, the same every time: a node's seed offset. */
export function hash01(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return ((h >>> 0) % 100000) / 100000
}

/** The top-level part (a child of the root) a node sits under, or null for the root itself. */
export function regionOf(model, id) {
  if (id === model.root) return null
  const up = [id, ...ancestors(model, id)]
  return up.length >= 2 ? up[up.length - 2] : id
}

/** Where each top-level part drifts to: spread evenly around the root. */
export function regionHomes(model, radius = 520) {
  const parts = model.children.get(model.root) ?? []
  const homes = new Map()
  parts.forEach((id, index) => {
    const angle = (index / Math.max(parts.length, 1)) * TAU - Math.PI / 2
    homes.set(id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
  })
  return homes
}

export const createSim = () => ({ pos: new Map() })

/** Gives each shown node without a position one next to its container, offset by its own hash. */
export function seed(sim, model, view, homes) {
  for (const id of view.ids) {
    if (sim.pos.has(id)) continue
    const up = ancestors(model, id).find((a) => sim.pos.has(a))
    const base = up ? sim.pos.get(up) : (homes.get(regionOf(model, id)) ?? { x: 0, y: 0 })
    const angle = hash01(id) * TAU
    const reach = up ? 40 + hash01(`${id}#`) * 60 : 0
    sim.pos.set(id, {
      x: base.x + Math.cos(angle) * reach,
      y: base.y + Math.sin(angle) * reach,
      vx: 0,
      vy: 0,
      pinned: false,
    })
  }
}

/**
 * One step of the free layout, scaled by `alpha` (1 at the start, falling to 0 as it settles).
 * Returns the average speed, so the caller can stop when it is small.
 */
export function forceStep(sim, model, view, homes, alpha, radius = () => 10) {
  const ids = view.ids
  const p = ids.map((id) => sim.pos.get(id))
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      let dx = p[i].x - p[j].x
      let dy = p[i].y - p[j].y
      let d2 = dx * dx + dy * dy
      if (d2 > 360000) continue
      if (d2 < 1) {
        dx = hash01(ids[i]) - 0.5
        dy = hash01(ids[j]) - 0.5
        d2 = 1
      }
      const d = Math.sqrt(d2)
      const min = radius(ids[i]) + radius(ids[j]) + 14
      const push = ((900 + (d < min ? (min - d) * 40 : 0)) / d2) * alpha
      p[i].vx += (dx / d) * push
      p[i].vy += (dy / d) * push
      p[j].vx -= (dx / d) * push
      p[j].vy -= (dy / d) * push
    }
  }
  for (const edge of view.edges) {
    const a = sim.pos.get(edge.from)
    const b = sim.pos.get(edge.to)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const d = Math.hypot(dx, dy) || 1
    const rest = edge.structure ? 70 + 30 * Math.min(model.depth.get(edge.to) ?? 1, 3) : 260
    const pull = (d - rest) * (edge.structure ? 0.04 : 0.004) * alpha
    a.vx += (dx / d) * pull
    a.vy += (dy / d) * pull
    b.vx -= (dx / d) * pull
    b.vy -= (dy / d) * pull
  }
  let speed = 0
  for (const [index, id] of ids.entries()) {
    const n = p[index]
    const home = homes.get(regionOf(model, id)) ?? { x: 0, y: 0 }
    n.vx += (home.x - n.x) * 0.0035 * alpha
    n.vy += (home.y - n.y) * 0.0035 * alpha
    if (n.pinned) {
      n.vx = 0
      n.vy = 0
      continue
    }
    n.vx *= 0.82
    n.vy *= 0.82
    n.x += n.vx
    n.y += n.vy
    speed += Math.hypot(n.vx, n.vy)
  }
  return speed / Math.max(ids.length, 1)
}

/**
 * The mind-map positions of the shown nodes: each shown node takes an angle in proportion to how
 * many shown nodes sit under it, and a ring by its depth among the shown ones. `Map id -> {x, y}`.
 */
export function mindMap(model, view, ring = 170) {
  const out = new Map()
  const kids = (id) => model.children.get(id).filter((c) => view.shown.has(c) || hasShownBelow(c))
  const hasShownBelow = (id) =>
    model.children.get(id).some((c) => view.shown.has(c) || hasShownBelow(c))
  const weight = new Map()
  const perLevel = []
  const size = (id, level) => {
    const here = view.shown.has(id)
    if (here) perLevel[level] = (perLevel[level] ?? 0) + 1
    const w = kids(id).reduce((sum, c) => sum + size(c, here ? level + 1 : level), 0) || 1
    weight.set(id, w)
    return w
  }
  if (model.root === null) return out
  size(model.root, 0)
  // A ring is far enough out for its nodes to sit side by side, and a ring apart from the last.
  const radii = []
  perLevel.forEach((count, level) => {
    radii[level] = level === 0 ? 0 : Math.max(radii[level - 1] + ring, (count * 24) / TAU)
  })
  const place = (id, from, to, level) => {
    const mid = (from + to) / 2
    if (view.shown.has(id))
      out.set(id, { x: Math.cos(mid) * radii[level], y: Math.sin(mid) * radii[level] })
    let at = from
    const next = view.shown.has(id) ? level + 1 : level
    for (const child of kids(id)) {
      const span = ((to - from) * weight.get(child)) / weight.get(id)
      place(child, at, at + span, next)
      at += span
    }
  }
  place(model.root, -Math.PI / 2, -Math.PI / 2 + TAU, 0)
  return out
}
