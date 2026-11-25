// Fixtures for the boundary and the geocoder (#1009). INSIDE is a public address in the area, the
// Door Creek Park shelter, with the point the City's locator answered on 2026-11-24 (recorded, not
// fetched: no test calls the network). The other two points are made, not recorded: they sit 30 m
// inside and 60 m outside the middle of the polygon's longest edge, so no real address is used for
// them. Nothing here names a resident.

/** 7035 Littlemore Dr, the Door Creek Park shelter: inside, about 500 m from any edge. */
export const INSIDE = [-89.254140370164, 43.095074776666]
/** 30 m inside the polygon's longest edge (on the I-94 side). */
export const JUST_INSIDE = [-89.247382, 43.098764]
/** 60 m outside the same edge. */
export const JUST_OUTSIDE = [-89.246275, 43.098767]

/** A small square polygon (about 1 km) in the shape of the checked-in copy, with optional holes. */
export function square(
  holes = [],
  ring = [
    [0, 0],
    [0.01, 0],
    [0.01, 0.01],
    [0, 0.01],
    [0, 0],
  ],
) {
  return {
    source: square.record.source,
    naId: square.record.naId,
    fetchedAt: '2026-11-24',
    geometry: { type: 'Polygon', coordinates: [ring, ...holes] },
  }
}
square.record = {
  source: 'https://example.org/layer/1',
  field: 'NA_ID',
  naId: 5,
  name: 'Square',
  file: 'square.json',
  bounds: { west: -1, south: -1, east: 1, north: 1 },
}

/** What the layer's query answers (GeoJSON) for the square's feature; one vertex has long digits. */
export function layerAnswer() {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { NA_ID: 5, NEIGHB_NAME: 'Square    ' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [0.010000123456789, 0],
              [0.01, 0.01],
              [0, 0.01],
              [0, 0],
            ],
          ],
        },
      },
    ],
  })
}

/** An ArcGIS locator answer with these candidates: `[address, [lon, lat], score]`. */
export const locatorAnswer = (...candidates) =>
  JSON.stringify({
    spatialReference: { wkid: 4326, latestWkid: 4326 },
    candidates: candidates.map(([address, [x, y], score]) => ({
      address,
      location: { x, y },
      score,
      attributes: {},
      extent: { xmin: x - 0.001, ymin: y - 0.001, xmax: x + 0.001, ymax: y + 0.001 },
    })),
  })

/** The locator's recorded answer for the shelter, by the street address asked for. */
export const LOCATOR = {
  '7035 Littlemore Dr': locatorAnswer([
    '7035 Littlemore Dr, Madison, Wisconsin, 53718',
    INSIDE,
    100,
  ]),
}
