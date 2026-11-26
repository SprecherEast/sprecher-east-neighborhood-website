/**
 * Pointer, wheel and keyboard input on the map canvas (#1463): drag to pan, wheel and pinch to
 * zoom, drag a node (its shown children travel with it and it stays pinned), tap or click to
 * select, tap twice to open or close, right-click to unpin. The app gives it `host`, a few
 * functions that read and change the scene; this file holds no scene of its own. Browser code.
 */
import { panBy, pinch, zoomAt } from './camera.mjs'

const MOVED = 5
const DOUBLE_MS = 350
const KEY_PAN = 80

/** Attaches the input handlers; returns nothing, the listeners live as long as the canvas. */
export function attachPointer(canvas, host) {
  const pointers = new Map()
  let gesture = null
  let lastTap = { id: null, at: 0 }
  const at = (e) => {
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return
    canvas.setPointerCapture(e.pointerId)
    const p = at(e)
    pointers.set(e.pointerId, { ...p, start: p, time: e.timeStamp })
    host.interrupt()
    if (pointers.size >= 2) {
      gesture = { type: 'pinch', moved: true }
      return
    }
    const id = host.hit(p.x, p.y, e.pointerType !== 'mouse')
    gesture = id
      ? { type: 'node', id, moved: false, group: host.subtree(id) }
      : { type: 'pan', moved: false }
  })

  canvas.addEventListener('pointermove', (e) => {
    const p = at(e)
    const before = pointers.get(e.pointerId)
    if (!before) {
      if (e.pointerType === 'mouse') host.hover(host.hit(p.x, p.y, false), e.clientX, e.clientY)
      return
    }
    if (pointers.size === 2) {
      const prev = [...pointers.values()].map(({ x, y }) => ({ x, y }))
      pointers.set(e.pointerId, { ...before, ...p })
      const next = [...pointers.values()].map(({ x, y }) => ({ x, y }))
      host.setCamera(pinch(host.camera(), prev, next))
      return
    }
    const dx = p.x - before.x
    const dy = p.y - before.y
    pointers.set(e.pointerId, { ...before, ...p })
    if (!gesture) return
    if (!gesture.moved && Math.hypot(p.x - before.start.x, p.y - before.start.y) > MOVED)
      gesture.moved = true
    if (!gesture.moved) return
    if (gesture.type === 'node')
      host.dragNode(gesture.group, dx / host.camera().k, dy / host.camera().k)
    else if (gesture.type === 'pan') host.setCamera(panBy(host.camera(), dx, dy))
  })

  const end = (e) => {
    const was = pointers.get(e.pointerId)
    pointers.delete(e.pointerId)
    if (!was || !gesture) return
    if (pointers.size === 0) {
      if (!gesture.moved && e.type === 'pointerup') {
        if (gesture.type === 'node') {
          const double = lastTap.id === gesture.id && e.timeStamp - lastTap.at < DOUBLE_MS
          lastTap = double ? { id: null, at: 0 } : { id: gesture.id, at: e.timeStamp }
          if (double) host.open(gesture.id)
          else host.select(gesture.id, false)
        } else if (gesture.type === 'pan') host.background()
      }
      gesture = null
    } else if (pointers.size === 1) gesture = { type: 'pan', moved: true }
  }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
  canvas.addEventListener(
    'pointerleave',
    (e) => e.pointerType === 'mouse' && host.hover(null, 0, 0),
  )

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const p = at(e)
      const unit = e.deltaMode === 1 ? 16 : 1
      host.interrupt()
      host.setCamera(zoomAt(host.camera(), p.x, p.y, Math.exp(-e.deltaY * unit * 0.0015)))
    },
    { passive: false },
  )

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    const p = at(e)
    const id = host.hit(p.x, p.y, false)
    if (id) host.unpin(id)
  })

  canvas.addEventListener('keydown', (e) => {
    const moves = {
      ArrowLeft: [KEY_PAN, 0],
      ArrowRight: [-KEY_PAN, 0],
      ArrowUp: [0, KEY_PAN],
      ArrowDown: [0, -KEY_PAN],
    }
    const cam = host.camera()
    if (moves[e.key]) host.setCamera(panBy(cam, ...moves[e.key]))
    else if (e.key === '+' || e.key === '=')
      host.setCamera(zoomAt(cam, host.size().w / 2, host.size().h / 2, 1.25))
    else if (e.key === '-' || e.key === '_')
      host.setCamera(zoomAt(cam, host.size().w / 2, host.size().h / 2, 0.8))
    else return
    host.interrupt()
    e.preventDefault()
  })
}
