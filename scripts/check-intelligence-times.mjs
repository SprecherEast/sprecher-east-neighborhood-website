// The time check of scripts/check-intelligence.mjs: eval times use America/Chicago's offset.

// An offset that isn't America/Chicago's at that instant, in common.schema.json's grammar
const DATE_TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:\d{2})$/
const CHICAGO = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  timeZoneName: 'longOffset',
})
const chicagoOffset = (value) =>
  CHICAGO.formatToParts(new Date(value))
    .find((p) => p.type === 'timeZoneName')
    .value.slice(3)
const dateTimes = (value) =>
  typeof value === 'string'
    ? [value].filter((v) => DATE_TIME.test(v))
    : Object.values(value ?? {}).flatMap(dateTimes)

/** The problems with one eval case's times, as messages (a case tagged `wrong-offset` is meant to have one). */
export function offsetProblems(c) {
  if (c.tags?.includes('wrong-offset')) return []
  return dateTimes([c.input, c.given, c.graders]).flatMap((value) => {
    const offset = DATE_TIME.exec(value)[2]
    return chicagoOffset(value) === offset
      ? []
      : [`${c.id}: ${value} should use ${chicagoOffset(value)} in America/Chicago`]
  })
}
