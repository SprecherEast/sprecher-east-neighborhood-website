/**
 * Drawing (#1463): the shapes, the curved lines and the labels on the canvas. It only paints what
 * the scene says; the scene (positions, camera, colours, what is selected) is built by the app.
 * Browser code: it takes the 2D context as an argument and reads no globals.
 */
import { toScreen } from './camera.mjs'
import { paint } from './style.mjs'

const TAU = Math.PI * 2

/** The path of each shape around (x, y), `r` from the middle to the edge. */
const PATHS = {
  circle: (c, x, y, r) => c.arc(x, y, r, 0, TAU),
  ring: (c, x, y, r) => c.arc(x, y, r, 0, TAU),
  roundedSquare: (c, x, y, r) => c.roundRect(x - r, y - r, r * 2, r * 2, r * 0.35),
  tile: (c, x, y, r) => c.roundRect(x - r, y - r * 0.8, r * 2, r * 1.6, r * 0.2),
  document: (c, x, y, r) => c.rect(x - r * 0.75, y - r, r * 1.5, r * 2),
  hexagon: (c, x, y, r) => polygon(c, x, y, r, 6, 0),
  octagon: (c, x, y, r) => polygon(c, x, y, r, 8, Math.PI / 8),
  diamond: (c, x, y, r) => polygon(c, x, y, r * 1.2, 4, 0),
  triangle: (c, x, y, r) => polygon(c, x, y, r * 1.2, 3, -Math.PI / 2),
  pentagon: (c, x, y, r) => polygon(c, x, y, r, 5, -Math.PI / 2),
}

function polygon(c, x, y, r, sides, turn) {
  for (let i = 0; i < sides; i++) {
    const a = turn + (i / sides) * TAU
    if (i === 0) c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
    else c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  c.closePath()
}

export const shapeNames = () => Object.keys(PATHS)

/** Traces one shape on the context; the caller fills or strokes it. */
export function shapePath(ctx, shape, x, y, r) {
  ctx.beginPath()
  ;(PATHS[shape] ?? PATHS.circle)(ctx, x, y, r)
}

/** The control point that bends a line: a gentle curve, never straight. */
export function bend(a, b, amount = 0.14) {
  return { x: (a.x + b.x) / 2 + (b.y - a.y) * amount, y: (a.y + b.y) / 2 - (b.x - a.x) * amount }
}

const quad = (a, c, b, t) => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
})

function drawArrow(ctx, from, to, size) {
  const a = Math.atan2(to.y - from.y, to.x - from.x)
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - Math.cos(a - 0.4) * size, to.y - Math.sin(a - 0.4) * size)
  ctx.lineTo(to.x - Math.cos(a + 0.4) * size, to.y - Math.sin(a + 0.4) * size)
  ctx.closePath()
  ctx.fill()
}

/** The dots on the world, which fade out when zoomed far out. */
export function drawGrid(ctx, s) {
  const alpha = Math.min(1, (s.cam.k - 0.25) * 2)
  if (alpha <= 0) return
  const step = 60 * s.cam.k
  ctx.fillStyle = s.colors.muted
  ctx.globalAlpha = alpha * 0.35
  const x0 = ((s.cam.tx % step) + step) % step
  const y0 = ((s.cam.ty % step) + step) % step
  for (let x = x0; x < s.width; x += step)
    for (let y = y0; y < s.height; y += step) ctx.fillRect(x, y, 1.5, 1.5)
  ctx.globalAlpha = 1
}

/** Every line, then the light that travels along the ones at the selection. */
export function drawEdges(ctx, s) {
  for (const edge of s.view.edges) {
    const a = toScreen(s.cam, s.pos.get(edge.from).x, s.pos.get(edge.from).y)
    const b = toScreen(s.cam, s.pos.get(edge.to).x, s.pos.get(edge.to).y)
    const live = s.focus.size === 0 || (s.focus.has(edge.from) && s.focus.has(edge.to))
    const touched = s.selected !== null && (edge.from === s.selected || edge.to === s.selected)
    const style = s.layerStyles[edge.layer]
    const hue = edge.structure ? s.hueOf(edge.to) : style.hue
    const c = bend(a, b, edge.structure ? 0.08 : 0.16)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.quadraticCurveTo(c.x, c.y, b.x, b.y)
    ctx.strokeStyle = paint(hue, s.dark, touched ? 1 : live ? (edge.structure ? 0.5 : 0.62) : 0.1)
    ctx.lineWidth = edge.structure
      ? Math.max(0.8, 2.2 - (s.depthOf(edge.to) ?? 1) * 0.4)
      : 1 + Math.min(Math.log2(edge.count), 3) * 0.7 + (touched ? 1.2 : 0)
    ctx.setLineDash(edge.structure ? [] : style.dash)
    ctx.lineDashOffset = touched && !s.reducedMotion ? -s.time * 0.03 : 0
    ctx.stroke()
    ctx.setLineDash([])
    if (!edge.structure && live) {
      ctx.fillStyle = ctx.strokeStyle
      drawArrow(ctx, quad(a, c, b, 0.9), quad(a, c, b, 0.99), 6 + (touched ? 2 : 0))
    }
    if (touched && !s.reducedMotion) {
      for (let i = 0; i < 3; i++) {
        const p = quad(a, c, b, (s.time * 0.0003 + i / 3) % 1)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.2, 0, TAU)
        ctx.fillStyle = paint(hue, s.dark)
        ctx.fill()
      }
    }
  }
}

/** One node: its shape in its type's colour, a ring in its module's colour, and the marks. */
export function drawNode(ctx, s, id) {
  const node = s.model.nodes.get(id)
  const p = toScreen(s.cam, s.pos.get(id).x, s.pos.get(id).y)
  const style = s.typeStyles[node.type]
  const grown = Math.min(1, (s.time - (s.born.get(id) ?? -1e9)) / 350)
  const pop = s.reducedMotion || grown >= 1 ? 1 : 1 + Math.sin(grown * Math.PI) * 0.25 * grown
  let r = s.radius(id) * (0.55 + 0.45 * Math.min(s.cam.k, 2)) * pop
  if (!s.reducedMotion && (node.type === 'site' || node.type === 'module'))
    r *= 1 + Math.sin(s.time / 900) * 0.04
  ctx.globalAlpha = s.focus.size === 0 || s.focus.has(id) ? 1 : 0.22
  const fill = paint(s.fillHueOf(id), s.dark)
  if (style.shape === 'ring') {
    shapePath(ctx, 'circle', p.x, p.y, r)
    ctx.fillStyle = paint(style.hue, s.dark, 0.22)
    ctx.fill()
    ctx.strokeStyle = fill
    ctx.lineWidth = 2.5
    ctx.setLineDash(s.hasHidden(id) ? [5, 4] : [])
    ctx.stroke()
    ctx.setLineDash([])
  } else {
    shapePath(ctx, style.shape, p.x, p.y, r)
    ctx.fillStyle = fill
    ctx.fill()
    if (s.hasHidden(id)) {
      ctx.strokeStyle = s.colors.fg
      ctx.lineWidth = 1.5
      ctx.setLineDash([3, 3])
      shapePath(ctx, style.shape, p.x, p.y, r + 4)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
  const moduleHue = s.moduleHueOf(id)
  if (moduleHue !== null && node.type !== 'module') {
    shapePath(ctx, style.shape === 'ring' ? 'circle' : style.shape, p.x, p.y, r + 2)
    ctx.strokeStyle = paint(moduleHue, s.dark)
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  if (s.pinned.has(id)) {
    ctx.fillStyle = s.colors.fg
    ctx.fillRect(p.x + r * 0.6, p.y - r - 5, 5, 5)
  }
  if (s.changed.has(id)) {
    ctx.beginPath()
    ctx.arc(p.x + r * 0.8, p.y - r * 0.8, 4.5, 0, TAU)
    ctx.fillStyle = s.colors.warning
    ctx.fill()
  }
  if (id === s.selected || id === s.hover || s.path.includes(id)) {
    shapePath(ctx, style.shape === 'ring' ? 'circle' : style.shape, p.x, p.y, r + 6)
    ctx.strokeStyle = s.colors.ring
    ctx.lineWidth = 2.5
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

const shorten = (text, n) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)

/** Labels by importance and zoom, never over each other; the selected and hovered always show. */
export function drawLabels(ctx, s) {
  ctx.font = '12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const must = (id) => id === s.selected || id === s.hover || s.path.includes(id)
  const rank = (id) => {
    const type = s.model.nodes.get(id).type
    return must(id)
      ? 0
      : type === 'site' || type === 'module'
        ? 1
        : s.focus.has(id)
          ? 2
          : s.typeStyles[type].shape === 'ring'
            ? 3
            : 4
  }
  const showAt = [0, 0, 0.1, 0.45, 1.1]
  const order = s.view.ids
    .filter((id) => s.cam.k >= showAt[rank(id)] || (s.focus.has(id) && s.focus.size > 0))
    .sort((a, b) => rank(a) - rank(b))
  const taken = []
  for (const id of order) {
    const p = toScreen(s.cam, s.pos.get(id).x, s.pos.get(id).y)
    if (p.x < -50 || p.y < -20 || p.x > s.width + 50 || p.y > s.height + 20) continue
    const node = s.model.nodes.get(id)
    const text = must(id) ? node.name : shorten(node.name, 22)
    const w = ctx.measureText(text).width + 6
    const box = {
      x: p.x - w / 2,
      y: p.y + s.radius(id) * (0.55 + 0.45 * Math.min(s.cam.k, 2)) * 1.12 + 6,
      w,
      h: 15,
    }
    if (
      rank(id) > 0 &&
      taken.some(
        (t) => box.x < t.x + t.w && box.x + box.w > t.x && box.y < t.y + t.h && box.y + box.h > t.y,
      )
    )
      continue
    taken.push(box)
    ctx.globalAlpha = s.focus.size === 0 || s.focus.has(id) ? 1 : 0.3
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.strokeStyle = s.colors.bg
    ctx.strokeText(text, p.x, box.y)
    ctx.fillStyle = s.colors.fg
    ctx.fillText(text, p.x, box.y)
  }
  ctx.globalAlpha = 1
}

/** The overview map: every shown node as a dot, and the part in view as a frame. */
export function drawMinimap(ctx, s, size) {
  ctx.clearRect(0, 0, size.w, size.h)
  const xs = s.view.ids.map((id) => s.pos.get(id).x)
  const ys = s.view.ids.map((id) => s.pos.get(id).y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const k = Math.min((size.w - 12) / Math.max(x1 - x0, 1), (size.h - 12) / Math.max(y1 - y0, 1))
  const map = { k, tx: size.w / 2 - ((x0 + x1) / 2) * k, ty: size.h / 2 - ((y0 + y1) / 2) * k }
  for (const id of s.view.ids) {
    const p = toScreen(map, s.pos.get(id).x, s.pos.get(id).y)
    ctx.fillStyle = paint(s.typeStyles[s.model.nodes.get(id).type].hue, s.dark)
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
  }
  const tl = { x: (0 - s.cam.tx) / s.cam.k, y: (0 - s.cam.ty) / s.cam.k }
  const a = toScreen(map, tl.x, tl.y)
  ctx.strokeStyle = s.colors.fg
  ctx.lineWidth = 1.5
  ctx.strokeRect(a.x, a.y, (s.width / s.cam.k) * k, (s.height / s.cam.k) * k)
  return map
}
