/**
 * How wide each slice of a bar is drawn, in percent of the bar, when some slice is too narrow for
 * its label (#1121). `shares` are the exact shares (any total; they are scaled to 100) and
 * `minimums` the least width each slice needs, in the same percent. A slice below its minimum is
 * drawn at the minimum; the extra comes from the slices that stay above theirs, in proportion to
 * their widths, so the order and the rough sizes are kept and the total is always 100. Minimums that
 * cannot all fit are scaled down together. Pure, so the bar and its test share one rule.
 */
export function widenToFit(shares: readonly number[], minimums: readonly number[]): number[] {
  const whole = shares.reduce((sum, share) => sum + share, 0) || 1
  const exact = shares.map((share) => (share / whole) * 100)
  const asked = minimums.reduce((sum, minimum) => sum + minimum, 0)
  const mins = asked > 100 ? minimums.map((minimum) => (minimum / asked) * 100) : [...minimums]
  const pinned = new Set<number>()
  // Pinning one slice can push another below its minimum, so repeat until nothing changes
  for (let pass = 0; pass <= exact.length; pass++) {
    const free = exact.flatMap((share, index) => (pinned.has(index) ? [] : [share]))
    const freeTotal = free.reduce((sum, share) => sum + share, 0)
    const room = 100 - [...pinned].reduce((sum, index) => sum + (mins[index] ?? 0), 0)
    const scale = freeTotal > 0 ? room / freeTotal : 0
    const tooNarrow = exact.findIndex(
      (share, index) => !pinned.has(index) && share * scale < (mins[index] ?? 0) - 1e-9,
    )
    if (tooNarrow < 0) {
      return exact.map((share, index) => (pinned.has(index) ? (mins[index] ?? 0) : share * scale))
    }
    pinned.add(tooNarrow)
  }
  return exact
}
