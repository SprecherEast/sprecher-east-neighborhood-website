/** Adds a day (`yyyy-mm-dd`) that is not in the list, takes out one that is; the days stay oldest first */
export function toggleDay(days: readonly string[], day: string): string[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()
}
