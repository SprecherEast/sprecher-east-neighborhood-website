/** Map maths for the About page picture: a flat projection and small helpers. No dependencies. */

/** Pictures are 4:3, so a 4:3 slice of ground is drawn. */
export const WIDTH = 1600
export const HEIGHT = 1200

/** The ground shown: west, south, east, north in degrees. Roughly 4.4 km by 3.3 km, centred on the boundary. */
export const EXTENT = { west: -89.2846, south: 43.0785, east: -89.23, north: 43.1085 }

const METERS_PER_DEGREE_LAT = 111_200

/** Metres per degree of longitude at the middle of the picture */
export function metersPerDegreeLon(extent = EXTENT) {
  return Math.cos((((extent.south + extent.north) / 2) * Math.PI) / 180) * 111_320
}

/** Longitude/latitude to picture pixels, north up. Same scale both ways, so the picture is level and true. */
export function project([lon, lat], extent = EXTENT) {
  const x = ((lon - extent.west) / (extent.east - extent.west)) * WIDTH
  const y = ((extent.north - lat) / (extent.north - extent.south)) * HEIGHT
  return [x, y]
}

/** Pixels per metre on the picture */
export function pixelsPerMeter(extent = EXTENT) {
  return WIDTH / ((extent.east - extent.west) * metersPerDegreeLon(extent))
}

/** The ground really is 4:3 (so one pixel is the same distance both ways), within half a percent */
export function groundAspect(extent = EXTENT) {
  const w = (extent.east - extent.west) * metersPerDegreeLon(extent)
  const h = (extent.north - extent.south) * METERS_PER_DEGREE_LAT
  return w / h
}

/** SVG path data for rings (polygon) or one line, in picture pixels */
export function pathOf(points, { close = false } = {}) {
  const body = points
    .map((point, i) => {
      const [x, y] = project(point)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join('')
  return close ? `${body}Z` : body
}

/** All rings of a GeoJSON Polygon or MultiPolygon, as one path (holes cut out with even-odd fill) */
export function polygonPath(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.flatMap((rings) => rings.map((ring) => pathOf(ring, { close: true }))).join('')
}

/** Axis-aligned box of a label, turned about its centre by `angle` degrees */
export function labelBox({ x, y, width, height, angle = 0 }) {
  const a = (angle * Math.PI) / 180
  const w = Math.abs(width * Math.cos(a)) + Math.abs(height * Math.sin(a))
  const h = Math.abs(width * Math.sin(a)) + Math.abs(height * Math.cos(a))
  return { left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 }
}

export function boxesOverlap(a, b, gap = 0) {
  return (
    a.left < b.right + gap &&
    b.left < a.right + gap &&
    a.top < b.bottom + gap &&
    b.top < a.bottom + gap
  )
}

export function boxInside(box, margin = 0) {
  return (
    box.left >= margin &&
    box.top >= margin &&
    box.right <= WIDTH - margin &&
    box.bottom <= HEIGHT - margin
  )
}
