/** The camera (#1463): the view of the world on the screen, pan and zoom. Pure. A point on the
 *  screen is `world * k + (tx, ty)`. */

export const ZOOM_MIN = 0.05
export const ZOOM_MAX = 6

export const clampZoom = (k) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k))
export const toScreen = (cam, x, y) => ({ x: x * cam.k + cam.tx, y: y * cam.k + cam.ty })
export const toWorld = (cam, x, y) => ({ x: (x - cam.tx) / cam.k, y: (y - cam.ty) / cam.k })

/** Zooms by `factor` so the world point under (sx, sy) stays under it: toward the cursor or pinch. */
export function zoomAt(cam, sx, sy, factor) {
  const k = clampZoom(cam.k * factor)
  const world = toWorld(cam, sx, sy)
  return { k, tx: sx - world.x * k, ty: sy - world.y * k }
}

export const panBy = (cam, dx, dy) => ({ ...cam, tx: cam.tx + dx, ty: cam.ty + dy })

/** The camera that puts a world point at the middle of a `width` by `height` screen. */
export function centerOn(cam, x, y, width, height, k = cam.k) {
  const zoom = clampZoom(k)
  return { k: zoom, tx: width / 2 - x * zoom, ty: height / 2 - y * zoom }
}

/** The camera that fits the points in the screen with a margin; the middle at zoom 1 for no points. */
export function fitPoints(points, width, height, margin = 60, maxZoom = 1.4) {
  if (points.length === 0) return centerOn({ k: 1 }, 0, 0, width, height, 1)
  let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity]
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const w = Math.max(maxX - minX, 1)
  const h = Math.max(maxY - minY, 1)
  const k = Math.min(maxZoom, (width - margin * 2) / w, (height - margin * 2) / h)
  return centerOn({ k }, (minX + maxX) / 2, (minY + maxY) / 2, width, height, k)
}

/**
 * Two fingers: the camera that keeps the two world points under the two fingers, so a pinch both
 * zooms and pans. `before` and `after` are `[{x, y}, {x, y}]` on the screen.
 */
export function pinch(cam, before, after) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const d0 = dist(before[0], before[1])
  if (d0 < 1) return cam
  const k = clampZoom((cam.k * dist(after[0], after[1])) / d0)
  const mid0 = { x: (before[0].x + before[1].x) / 2, y: (before[0].y + before[1].y) / 2 }
  const mid1 = { x: (after[0].x + after[1].x) / 2, y: (after[0].y + after[1].y) / 2 }
  const world = toWorld(cam, mid0.x, mid0.y)
  return { k, tx: mid1.x - world.x * k, ty: mid1.y - world.y * k }
}
