# Map picture generator

Draws `public/images/sprecher-east-map.png`, the picture on the About page's map block. The picture
is rebuilt from data, never edited by hand: change the data or `render.mjs`, then run

```
node scripts/map-preview/build.mjs          # writes the PNG
node scripts/map-preview/build.mjs --svg    # also writes the SVG beside it, for a look
npx vitest run scripts/map-preview          # checks it
```

The PNG is 1600 by 1200 (4:3), north up, drawn at one scale both ways so it is level and true to
the ground (about 4.4 km by 3.3 km). A 500 m scale bar sits in the corner. Labels use Poppins, so
install it locally before building; CI only runs the tests, which need no fonts.

## What is drawn

- **Boundary:** the 15-sided shape of the live Google My Maps map the page links to. It follows the
  City of Madison's Sprecher East polygon (`NA_ID` 146) closely but not exactly: about 2.84 km² against
  2.89 km², a difference of about 5% (checked 2026-11-21).
- **Roads, parks and neighbors:** City of Madison open data, public domain, checked 2026-11-21.
  `data/madison-map.json` is a trimmed snapshot (roads without alleys, parks, the neighbors in view).
  `data/sources.json` lists the layers and the query used to take it.
- **Door Creek Park:** the City's park polygon covers the northern part inside the boundary and the
  strip the boundary leaves out, the white notch of the old picture. Both parts carry the park's
  name, and the page caption says only what this data shows.

## Checks (`render.test.mjs`)

The picture is 4:3 and north up, every shape it draws is named, every label stays on the picture, no
two labels overlap, and each label stays readable at the width the page shows. Add a label to
`buildLabels` and the tests cover it.

## Updating

When the My Maps boundary changes, replace `boundary` in the data file with its points (longitude,
latitude; export the KML from the map's menu), rebuild, and note the difference from the City layer on
the issue. Then upload the new picture to the About page's map block in Admin.
