/** The value, or a clear failure when a test expected one and there is none (instead of `!`) */
export function present<T>(value: T | null | undefined, what = 'value'): T {
  if (value === null || value === undefined) throw new Error(`Expected a ${what}, got ${value}`)
  return value
}
