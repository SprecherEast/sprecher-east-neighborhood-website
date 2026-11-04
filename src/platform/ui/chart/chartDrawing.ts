/**
 * The attribute `Chart` puts on its drawing's box (#681). `ChartZoom` reads it to know a click was
 * on the drawing; `CHART_LARGE_WIDTH` and `ChartZoom`'s pointer cursor name it in Tailwind classes,
 * which must be written out in full, so `chartDrawing.test.ts` checks they agree.
 */
export const CHART_DRAWING_ATTRIBUTE = 'data-chart-drawing'
export const CHART_DRAWING_SELECTOR = `[${CHART_DRAWING_ATTRIBUTE}]`
