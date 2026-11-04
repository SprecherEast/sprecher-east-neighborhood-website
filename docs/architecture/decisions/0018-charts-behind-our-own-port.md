# 0018: Charts behind our own port; plain HTML for square grids, visx for SVG kinds

- **Date:** 2026-11-04
- **Status:** Accepted. Reverses two parts of #592: the waffle as SVG, and the data table open by default.

## Context

The owner asked for beautiful graphs and diagrams (2026-11-02, Claude conversation, quoted on #592)
and, on 2026-11-03 (Claude Code session, text), for an established open-source chart library used
behind an interface, as one common component, so the site isn't locked in. #592 chose visx 4.0.0
(MIT, renders as a server component with 0 KB of client JavaScript) over Recharts, which draws
nothing on the server and adds 99 to 128 KB to the browser.

For the 2027 budget post (#645) the owner asked for more charts so a neighbor who knows nothing
about taxes can follow it. Most of what that needs is a grid of squares and a row of tiles. Those need
no scales, no text measuring and no library: HTML in a CSS grid is sharp at any width, and a square
is a mark a reader can count.

Native first (#639): HTML and CSS draw the grids; Payload and Next have no chart; visx (step 3 of
the ladder) draws the bars and stacked bars in #663; our code is the spec, the port and the tests.

## Decision

- `src/platform/lib/chart/` holds the chart as plain data: `ChartSpec` (a zod discriminated union:
  `units`, `bar`, `stacked`), `parseChartSpec`, `toChartTable`, `toChartPoints`, `toChartSummary`,
  `toUnitCounts` and `toUnitCells` (largest remainder, exactly N cells) and `formatValue`.
- `src/platform/ui/chart/` holds the port, `ChartAdapter` (`output: 'svg' | 'html'`), the registry,
  the palette (`chart-1` to `chart-6`, a part's slot is its position + 1 and never repeats), `Chart`
  and its table. `Chart` is the only component the app uses to draw one.
- Adapters: `css` draws `units` as HTML; `text` draws every kind as words and is the fallback;
  `visx` (in #663) will draw `bar` and `stacked`. Each is in its own folder under `adapters/`.
- ESLint (`CHART_LIBRARIES` in `eslint.boundaries.config.mjs`) allows `@visx/*`, `d3-*`,
  `recharts`, `echarts` and `@nivo/*` only in `src/platform/ui/chart/adapters/`. A test lints real
  sources to prove it fires.
- `describeChartAdapter` (the contract) runs for every adapter: one `[data-chart-mark]` per datum
  or cell in the server markup, no `style` and no colour literal, palette classes only, labels and
  values as text and none on a coloured mark, any `img` named by existing ids, and axe. An `svg`
  adapter must also draw `<svg role="img">`.
- Reversed from #592: the waffle is HTML, not SVG (it needs no measuring); the data table starts
  closed under "Show the numbers", because the legend and captions already print the values.

## Consequences

Swapping a library is one new adapter folder that passes the contract and one line in the registry;
no post, block or Markdown changes. The grids cost no chart JavaScript. `Chart` is imported by its
file, not from the UI index, so zod and the adapters never reach a client bundle that only needs a
`Button`. Colour is never the only cue: parts are named in a key and in a table, and hatching marks
patterned parts. The cost is that two kinds of drawing exist (HTML and SVG) and each kind of chart
must say which adapter draws it.

## Links

#639, #592, #645, #659 (colours), #662 (swatch legend), #663 (visx bars)
