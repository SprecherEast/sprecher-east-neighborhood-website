import {
  HEIGHT,
  WIDTH,
  labelBox,
  pathOf,
  pixelsPerMeter,
  polygonPath,
  project,
} from './geometry.mjs'

/** Light palette that matches the site's theme in light and dark; every colour of the picture is here. */
export const COLORS = {
  land: '#eef0ec',
  neighbor: '#dfe4df',
  park: '#a9d6a0',
  boundaryFill: '#6cc3ad',
  boundaryLine: '#1d5a49',
  roadCasing: '#c4cac4',
  roadFill: '#ffffff',
  highwayFill: '#fbf3d9',
  highwayCasing: '#b9ad82',
  labelText: '#1f2a24',
  labelMuted: '#4a574f',
  pill: '#ffffff',
  pillLine: '#9aa59d',
  siteLabel: '#1d5a49',
  siteLabelText: '#ffffff',
}

const FONT = "Poppins, 'Helvetica Neue', Arial, sans-serif"
/** Poppins SemiBold runs wide; this is a safe upper bound of its average glyph width, in em */
const GLYPH_EM = 0.58

/** Road classes from the City file: 1 interstate, 3 arterial, 4 collector, 5 local, 6 ramp */
const ROAD_STYLE = {
  1: { width: 15, casing: 20, highway: true },
  6: { width: 8, casing: 12, highway: true },
  3: { width: 13, casing: 18 },
  4: { width: 9, casing: 13 },
  5: { width: 5, casing: 8 },
}

const SPRECHER_EAST = 'Sprecher East'
/** Neighbors drawn as shapes; each one has a label */
const LABELED_NEIGHBORS = ['North Star', 'Richmond Hill Homeowners']

function textWidth(lines, size) {
  return Math.max(...lines.map((line) => line.length)) * size * GLYPH_EM
}

/** Closest point of a road to a longitude, with the angle (degrees, -90..90) of the road there */
export function pointOnRoad(roads, names, nearLon) {
  let best
  for (const road of roads.filter((r) => names.includes(r.name))) {
    for (let i = 1; i < road.line.length; i++) {
      const [a, b] = [road.line[i - 1], road.line[i]]
      const distance = Math.abs((a[0] + b[0]) / 2 - nearLon)
      if (!best || distance < best.distance) best = { distance, a, b }
    }
  }
  if (!best) throw new Error(`No road named ${names.join(' / ')}`)
  const [x1, y1] = project(best.a)
  const [x2, y2] = project(best.b)
  let angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  if (angle > 90) angle -= 180
  if (angle < -90) angle += 180
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, angle }
}

/**
 * Every label of the picture, in picture pixels, with the box it fills. Kept apart from the drawing so a
 * test can prove that none overlap and all stay on the picture.
 */
export function buildLabels(data) {
  const r = data.roads
  const sprecher = pointOnRoad(r, ['S Sprecher Rd', 'Sprecher Rd'], -89.2665)
  const cottage = pointOnRoad(r, ['Cottage Grove Rd'], -89.2765)
  const interstate = pointOnRoad(
    r,
    ['I 94 (EB)', 'I 94 (WB)', 'I 39-90 (WB)', 'I 39-90 (EB)'],
    -89.2535,
  )
  const [parkX, parkY] = project([-89.251, 43.0995])
  const [starX, starY] = project([-89.2763, 43.0935])
  const [hillX, hillY] = project([-89.2742, 43.0815])
  const [siteX, siteY] = project([-89.2582, 43.0958])

  const defs = [
    { id: 'site', kind: 'site', lines: [SPRECHER_EAST], size: 50, x: siteX, y: siteY },
    { id: 'i94', kind: 'road', lines: ['I-94'], size: 48, ...interstate, angle: 0 },
    {
      id: 'sprecher',
      kind: 'road',
      lines: ['Sprecher Rd'],
      size: 48,
      ...sprecher,
      y: 270,
      angle: -90,
    },
    {
      id: 'cottage',
      kind: 'road',
      lines: ['Cottage Grove Rd'],
      size: 48,
      ...cottage,
      x: 275,
      angle: 0,
    },
    { id: 'park', kind: 'area', lines: ['Door', 'Creek', 'Park'], size: 46, x: parkX, y: parkY },
    { id: 'northStar', kind: 'area', lines: ['North Star'], size: 48, x: starX, y: starY },
    {
      id: 'richmond',
      kind: 'area',
      lines: ['Richmond Hill', 'Homeowners'],
      size: 46,
      x: hillX,
      y: hillY,
    },
  ]
  return defs.map((label) => {
    const pad = label.kind === 'road' ? 14 : 6
    const width = textWidth(label.lines, label.size) + pad * 2
    const height = label.lines.length * label.size * 1.25 + pad * 2
    return {
      ...label,
      angle: label.angle ?? 0,
      width,
      height,
      box: labelBox({ ...label, width, height }),
    }
  })
}

function labelSvg(label) {
  const { x, y, size, lines, kind, angle } = label
  const lineHeight = size * 1.25
  const first = y - ((lines.length - 1) * lineHeight) / 2
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${x.toFixed(1)}" y="${(first + i * lineHeight).toFixed(1)}">${line}</tspan>`,
    )
    .join('')
  const rotate = angle
    ? ` transform="rotate(${angle.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"`
    : ''
  const text = (fill, extra = '') =>
    `<text font-family="${FONT}" font-weight="600" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="${fill}"${extra}>${tspans}</text>`
  if (kind === 'site' || kind === 'road') {
    const { width: w, height: h } = label
    const shape =
      kind === 'site'
        ? { rx: h / 2, fill: COLORS.siteLabel }
        : { rx: h / 3, fill: COLORS.pill, stroke: COLORS.pillLine }
    const stroke = shape.stroke ? ` stroke="${shape.stroke}" stroke-width="2"` : ''
    const box = `<rect x="${(x - w / 2).toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${shape.rx.toFixed(1)}" fill="${shape.fill}"${stroke}/>`
    return `<g${rotate}>${box}${text(kind === 'site' ? COLORS.siteLabelText : COLORS.labelText)}</g>`
  }
  const halo = text(
    COLORS.pill,
    ` stroke="${COLORS.pill}" stroke-width="7" stroke-linejoin="round"`,
  )
  return `<g${rotate}>${halo}${text(COLORS.labelMuted)}</g>`
}

function scaleBar() {
  const meters = 500
  const length = meters * pixelsPerMeter()
  const x = WIDTH - 56 - length - 130
  const y = HEIGHT - 56
  return (
    `<g font-family="${FONT}" font-weight="600" font-size="26" fill="${COLORS.labelText}">` +
    `<rect x="${x - 16}" y="${y - 52}" width="${(length + 130).toFixed(0)}" height="84" rx="14" fill="${COLORS.pill}" fill-opacity="0.9"/>` +
    `<path d="M${x} ${y - 12}V${y}H${(x + length).toFixed(1)}V${y - 12}" fill="none" stroke="${COLORS.labelText}" stroke-width="4"/>` +
    `<text x="${(x + length + 16).toFixed(1)}" y="${y}" dominant-baseline="central">${meters} m</text>` +
    `</g>`
  )
}

function roadLines(roads, key) {
  return roads
    .filter((road) => ROAD_STYLE[road.class])
    .toSorted((a, b) => b.class - a.class)
    .map((road) => {
      const style = ROAD_STYLE[road.class]
      const stroke =
        key === 'casing'
          ? style.highway
            ? COLORS.highwayCasing
            : COLORS.roadCasing
          : style.highway
            ? COLORS.highwayFill
            : COLORS.roadFill
      const width = key === 'casing' ? style.casing : style.width
      return `<path d="${pathOf(road.line)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
    })
    .join('')
}

/** The whole picture as SVG text: the boundary of Sprecher East, the roads, parks and neighbors around it */
export function buildSvg(data) {
  const neighbors = data.neighborhoods
    .filter((n) => LABELED_NEIGHBORS.includes(n.name))
    .map(
      (n) => `<path d="${polygonPath(n.geometry)}" fill="${COLORS.neighbor}" fill-rule="evenodd"/>`,
    )
    .join('')
  // Only the park the page talks about is drawn, over the boundary's tint, so its two parts (inside
  // and the strip the boundary leaves out) read as one green shape under one name
  const park = data.parks
    .filter((p) => p.name === 'Door Creek Park')
    .map((p) => `<path d="${polygonPath(p.geometry)}" fill="${COLORS.park}" fill-rule="evenodd"/>`)
    .join('')
  const boundary = pathOf(data.boundary, { close: true })
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.land}"/>` +
    neighbors +
    roadLines(data.roads, 'casing') +
    roadLines(data.roads, 'fill') +
    `<path d="${boundary}" fill="${COLORS.boundaryFill}" fill-opacity="0.45"/>` +
    park +
    `<path d="${boundary}" fill="none" stroke="${COLORS.boundaryLine}" stroke-width="7" stroke-linejoin="round"/>` +
    buildLabels(data).map(labelSvg).join('') +
    scaleBar() +
    `</svg>`
  )
}
