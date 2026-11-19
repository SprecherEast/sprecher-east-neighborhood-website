/**
 * An official meeting is a public body's own meeting, such as the Common Council, a city
 * commission or the County Board (#122). It is marked "Official meeting" wherever it shows, and
 * its page links to the body's own agenda. The bodies are also the collection's options.
 */
export const OFFICIAL_BODIES = [
  { value: 'city', label: 'City of Madison' },
  { value: 'county', label: 'Dane County' },
] as const

export type OfficialBody = (typeof OFFICIAL_BODIES)[number]['value']

/** The body's name, for example "City of Madison" for `city`. */
export function formatOfficialBody(body: OfficialBody): string {
  return OFFICIAL_BODIES.find(({ value }) => value === body)?.label ?? body
}

/** True for a known body; anything else stored in the field counts as no body. */
export function isOfficialBody(value: unknown): value is OfficialBody {
  return OFFICIAL_BODIES.some((body) => body.value === value)
}

/** Longest agenda link accepted: a generous bound for a real agenda page's address. */
export const MAX_AGENDA_URL_LENGTH = 2048

/**
 * True for an absolute `https://` link, the only kind an agenda link may be: no `http:`, no
 * `javascript:` or other scheme, no relative path. It is stored as typed, so it must already be
 * clean: no spaces, tabs or line breaks anywhere (`new URL` would quietly drop them), no user name
 * or password in it, and at most `MAX_AGENDA_URL_LENGTH` characters.
 */
export function isAgendaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_AGENDA_URL_LENGTH) return false
  if (/\s/.test(value) || !/^https:\/\//i.test(value)) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' && url.hostname !== '' && url.username === '' && url.password === ''
    )
  } catch {
    return false
  }
}

/** The collection field's check: blank is fine (the link is optional), anything else must pass. */
export function validateAgendaUrl(value: unknown): true | string {
  if (value === null || value === undefined || value === '') return true
  return isAgendaUrl(value) || 'Enter the full agenda link, starting with https://'
}
