// Turns a length of time into words for a message, so a message never hard-codes "one hour" next
// to the setting that decides it (#551). Whole minutes only: link lifetimes are never shorter.

const MINUTE = 60_000
const UNITS = [
  { ms: 24 * 60 * MINUTE, one: 'a day', many: 'days' },
  { ms: 60 * MINUTE, one: 'an hour', many: 'hours' },
  { ms: MINUTE, one: 'a minute', many: 'minutes' },
] as const

/** "an hour", "a day", "3 hours": the largest unit that divides the duration evenly. */
export function formatDuration(ms: number): string {
  if (!Number.isInteger(ms / MINUTE) || ms < MINUTE) {
    throw new RangeError(`A duration must be a whole number of minutes, got ${ms} ms`)
  }
  const unit = UNITS.find((u) => ms % u.ms === 0) ?? UNITS[2]
  const count = ms / unit.ms
  return count === 1 ? unit.one : `${count} ${unit.many}`
}
