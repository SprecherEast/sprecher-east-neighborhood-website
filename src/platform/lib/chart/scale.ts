import type { ChartSpec } from './spec'

type Breakdown = Extract<ChartSpec, { kind: 'breakdown' }>

/** Under this many dollars in all, cents are kept, so a small estimate has no part rounded to nothing */
const KEEP_CENTS_BELOW = 100

/**
 * A breakdown with every amount multiplied by `factor`, shares and order unchanged (#1020): the
 * same split drawn for a different bill, such as the City's tax on the home a reader typed. Amounts
 * are whole dollars, since an estimate has no cents, unless the whole is small. A square's worth
 * scales too, so the grid keeps the squares it had. Pure and plain data, so it needs no chart
 * library and can run in the browser.
 */
export function scaleBreakdown(spec: Breakdown, factor: number): Breakdown {
  const whole = spec.areas.reduce((sum, area) => sum + area.value, 0) * factor
  const round = (value: number) => {
    const scaled = value * factor
    return whole < KEEP_CENTS_BELOW ? Math.round(scaled * 100) / 100 : Math.round(scaled)
  }
  return {
    ...spec,
    ...(spec.squareValue === undefined ? {} : { squareValue: spec.squareValue * factor }),
    areas: spec.areas.map((area) => ({
      ...area,
      value: round(area.value),
      ...(area.pieces
        ? { pieces: area.pieces.map((piece) => ({ ...piece, value: round(piece.value) })) }
        : {}),
    })),
  }
}
