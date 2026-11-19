import type { ChartSpec } from './spec'

type Breakdown = Extract<ChartSpec, { kind: 'breakdown' }>

/** Under this many dollars in all, cents are kept, so a small estimate has no part rounded to nothing */
const KEEP_CENTS_BELOW = 100

/**
 * `scaled` values rounded to `unit` so that they add up to exactly `target` (largest remainder):
 * each is cut down to a whole unit, then the units still owed go to the biggest cut-off fractions.
 */
function apportion(scaled: number[], target: number, unit: number): number[] {
  const inUnits = scaled.map((value) => value / unit)
  const floors = inUnits.map((value) => Math.floor(value + 1e-9))
  let owed = Math.round(target / unit) - floors.reduce((sum, n) => sum + n, 0)
  const byRemainder = inUnits
    .map((value, index) => ({ index, rest: value - (floors[index] ?? 0) }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index)
  for (const { index } of byRemainder) {
    if (owed <= 0) break
    floors[index] = (floors[index] ?? 0) + 1
    owed -= 1
  }
  return floors.map((n) => Math.round(n * unit * 100) / 100)
}

/**
 * A breakdown with every amount multiplied by `factor`, shares and order unchanged (#1020): the
 * same split drawn for a different bill, such as the City's tax on the home a reader typed. Amounts
 * are whole dollars, since an estimate has no cents, unless the whole is small. The areas add up
 * to the scaled whole exactly, and an area's pieces never add up to more than the area (largest
 * remainder), so every line agrees with the bill it is a slice of. A square's worth scales too, so
 * the grid keeps the squares it had. Pure and plain data, so it needs no chart library and can run
 * in the browser.
 */
export function scaleBreakdown(spec: Breakdown, factor: number): Breakdown {
  const whole = spec.areas.reduce((sum, area) => sum + area.value, 0) * factor
  const unit = whole < KEEP_CENTS_BELOW ? 0.01 : 1
  const areaValues = apportion(
    spec.areas.map((area) => area.value * factor),
    whole,
    unit,
  )
  return {
    ...spec,
    ...(spec.squareValue === undefined ? {} : { squareValue: spec.squareValue * factor }),
    areas: spec.areas.map((area, index) => {
      const value = areaValues[index] ?? 0
      if (!area.pieces) return { ...area, value }
      const shown = area.pieces.reduce((sum, piece) => sum + piece.value, 0) * factor
      const pieceValues = apportion(
        area.pieces.map((piece) => piece.value * factor),
        Math.min(shown, value),
        unit,
      )
      return {
        ...area,
        value,
        pieces: area.pieces.map((piece, i) => ({ ...piece, value: pieceValues[i] ?? 0 })),
      }
    }),
  }
}
