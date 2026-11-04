/**
 * How many rows a list must have, judged on the real save only. Admin asks twice: while the form
 * is built (event `onChange`, where a list is its row count or a half-built row) and on the real
 * save (`submit`). Payload's own `minRows` check would run on every keystroke and leave "at least
 * 2 Tabs" on screen after the second tab was added, and it reads a number as the row count, so a
 * body sent as `entries: 2` passed it and was stored as an empty list. The lists keep `minRows`
 * and `maxRows` for the Add button and judge the count here: no opinion under `onChange`, and a
 * number is no rows. Never throws.
 */
export const rowsBetween =
  (min: number, max: number, noun: string) =>
  (value: unknown, { event }: { event?: unknown }): true | string => {
    if (event === 'onChange') return true
    const rows = Array.isArray(value) ? value.length : 0
    if (rows >= min && rows <= max) return true
    return `Add ${min} to ${max} ${noun}: there ${rows === 1 ? 'is' : 'are'} ${rows}.`
  }
