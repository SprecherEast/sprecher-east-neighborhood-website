/**
 * Small helpers for building the page's elements (#1463). Text only ever goes in as text, never as
 * markup, so nothing from the graph can inject HTML. Browser code.
 */
import { shapePath } from './draw.mjs'
import { paint } from './style.mjs'

/** `h('button', { class: 'x', onclick: fn, 'aria-pressed': 'true' }, 'Label', child)`. */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue
    if (key === 'class') el.className = value
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value)
    else el.setAttribute(key, value === true ? '' : String(value))
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue
    el.append(
      typeof kid === 'string' || typeof kid === 'number'
        ? document.createTextNode(String(kid))
        : kid,
    )
  }
  return el
}

/** Replaces the children of an element. */
export function fill(el, ...kids) {
  el.replaceChildren(
    ...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false),
  )
  return el
}

const dpr = () => window.devicePixelRatio || 1

/** A small canvas drawing: a node's shape in its colour, for a legend or a list. Decorative. */
export function shapeSwatch(shape, hue, dark, size = 18) {
  const canvas = h('canvas', {
    width: size * dpr(),
    height: size * dpr(),
    'aria-hidden': 'true',
    class: 'swatch',
    style: `width:${size}px;height:${size}px`,
  })
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(dpr(), dpr())
  shapePath(ctx, shape === 'ring' ? 'circle' : shape, size / 2, size / 2, size / 2 - 3)
  if (shape === 'ring') {
    ctx.fillStyle = paint(hue, dark, 0.22)
    ctx.fill()
    ctx.strokeStyle = paint(hue, dark)
    ctx.lineWidth = 2
    ctx.stroke()
  } else {
    ctx.fillStyle = paint(hue, dark)
    ctx.fill()
  }
  return canvas
}

/** A small canvas drawing of a line style: its colour and dash. Decorative. */
export function lineSwatch(hue, dash, dark, width = 34) {
  const canvas = h('canvas', {
    width: width * dpr(),
    height: 14 * dpr(),
    'aria-hidden': 'true',
    class: 'swatch',
    style: `width:${width}px;height:14px`,
  })
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(dpr(), dpr())
  ctx.beginPath()
  ctx.moveTo(2, 7)
  ctx.lineTo(width - 2, 7)
  ctx.setLineDash(dash)
  ctx.strokeStyle = paint(hue, dark)
  ctx.lineWidth = 2.5
  ctx.stroke()
  return canvas
}
