/** One part of a whole: only its key and value matter here */
type Part = { key: string; value: number }

/**
 * How many of `cells` squares each part gets, by the largest-remainder method: every part gets the
 * whole squares its share earns, then the squares still unfilled go to the biggest leftover
 * fractions (the earlier part wins a tie). The counts always add up to exactly `cells`, so a grid
 * of 100 is never 99 or 101. Shares are of the parts' own sum, so values that don't add up to 100
 * still fill the grid.
 */
export function toUnitCounts(parts: readonly Part[], cells: number): number[] {
  const sum = parts.reduce((total, part) => total + part.value, 0)
  if (!Number.isInteger(cells) || cells < 1 || parts.length === 0 || !(sum > 0)) {
    throw new RangeError('A grid needs at least one cell and parts that add up to more than zero')
  }
  const shares = parts.map((part) => (part.value / sum) * cells)
  const counts = shares.map(Math.floor)
  const byLeftover = shares
    .map((share, index) => ({ index, leftover: share - Math.floor(share) }))
    .sort((a, b) => b.leftover - a.leftover || a.index - b.index)
  const unfilled = cells - counts.reduce((total, count) => total + count, 0)
  for (const { index } of byLeftover.slice(0, unfilled)) counts[index] += 1
  return counts
}

/** The key of the part that fills each of the `cells` squares, in reading order */
export function toUnitCells(parts: readonly Part[], cells: number): string[] {
  return toUnitCounts(parts, cells).flatMap((count, index) =>
    Array.from({ length: count }, () => parts[index].key),
  )
}
