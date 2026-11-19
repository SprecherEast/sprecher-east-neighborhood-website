/**
 * How many rows a list must have. Admin asks twice: while the form is built (event `onChange`,
 * where a list arrives as its rows, which may hold only their id, or as its row count, a number)
 * and on the real save (`submit`).
 *
 * - On `onChange` the rows, or a number, are the real count, so it is judged: the reason shows under the
 *   field as rows are added or removed, and adding the last needed row clears it at once. Payload's
 *   own `minRows` check is replaced because it left "at least 2 Tabs" on screen after the second
 *   tab was added. Anything that can't be counted (no value, text) gets no opinion.
 * - On the real save a number is no rows: Payload read `entries: 2` as a row count, so a body sent
 *   that way passed its check and was stored as an empty list.
 *
 * The lists keep `minRows` and `maxRows` for the Add button. Never throws.
 */
export const rowsBetween =
  (min: number, max: number, noun: string) =>
  (value: unknown, { event }: { event?: unknown }): true | string => {
    const building = event === 'onChange'
    const counted = Array.isArray(value) || (building && typeof value === 'number')
    if (building && !counted) return true
    const rows = Array.isArray(value) ? value.length : counted ? (value as number) : 0
    if (rows >= min && rows <= max) return true
    return `Add ${min} to ${max} ${noun}: there ${rows === 1 ? 'is' : 'are'} ${rows}.`
  }
