/**
 * How each kind of node and line looks (#1463), decided once and from the data: a shape for each
 * node type, a hue for each node type, module and layer, and a dash for each layer. A type or
 * layer the data adds later gets the next hue and shape without a code change. Pure; the colours
 * are hue numbers, turned into a colour by `paint` for the theme (light or dark) in use, with a
 * lightness that keeps every one at 3:1 or more on the page background.
 */

/** The shapes a node can have; the drawing code has one routine for each. */
export const SHAPES = [
  'circle',
  'roundedSquare',
  'hexagon',
  'octagon',
  'diamond',
  'triangle',
  'tile',
  'document',
  'pentagon',
]

/** Shapes that say something about the kind of thing; any other type takes the next free one. */
const KNOWN_SHAPES = {
  site: 'circle',
  module: 'circle',
  group: 'ring',
  'page-cluster': 'ring',
  'platform-area': 'ring',
  feature: 'ring',
  collection: 'roundedSquare',
  global: 'roundedSquare',
  block: 'roundedSquare',
  endpoint: 'hexagon',
  'mcp-tool': 'hexagon',
  library: 'octagon',
  subagent: 'diamond',
  role: 'diamond',
  check: 'triangle',
  'ci-workflow': 'triangle',
  'business-rule': 'tile',
  note: 'document',
  decision: 'document',
  guideline: 'document',
  'process-doc': 'document',
}

/** The three dashes a layer's line can have, in turn: solid, long dash, fine dots. */
export const DASHES = [[], [10, 6], [2, 5]]

const GOLDEN = 137.508
export const hueAt = (index, offset = 0) => (offset + index * GOLDEN) % 360

/** `{ type: { shape, hue, size } }`: types in a stable order so a type keeps its look. */
export function typeStyles(nodeTypes) {
  const out = {}
  let spare = 0
  Object.keys(nodeTypes)
    .sort()
    .forEach((type, index) => {
      const shape = KNOWN_SHAPES[type] ?? ['circle', 'document', 'pentagon'][spare++ % 3]
      out[type] = {
        shape,
        hue: hueAt(index, 20),
        size: type === 'site' ? 26 : type === 'module' ? 19 : shape === 'ring' ? 15 : 11,
      }
    })
  return out
}

/** `{ layer: { hue, dash } }` in the order the data lists the layers. */
export function layerStyles(layers) {
  const out = {}
  layers.forEach((layer, index) => {
    out[layer.key] = { hue: hueAt(index, 200), dash: DASHES[index % DASHES.length] }
  })
  return out
}

/** `{ moduleId: hue }`, in the order of the modules. */
export function moduleHues(moduleIds) {
  return Object.fromEntries(moduleIds.map((id, index) => [id, hueAt(index, 80)]))
}

/** A hue as a CSS colour for the theme: darker on a light page, lighter on a dark one. */
export const paint = (hue, dark, alpha = 1) =>
  `hsl(${hue.toFixed(1)} ${dark ? 70 : 62}% ${dark ? 66 : 34}% / ${alpha})`

// Contrast arithmetic, for the test that keeps `paint` readable (WCAG 2.1 relative luminance).
export function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255))
}

export function luminance([r, g, b]) {
  const lin = (v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** The size of a node's drawing, a little larger for one with many children. */
export const radiusOf = (styles, node, childCount = 0) =>
  (styles[node.type]?.size ?? 11) + Math.min(Math.sqrt(childCount), 6)
