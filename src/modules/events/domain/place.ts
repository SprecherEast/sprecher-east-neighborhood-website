import type { EventLocationType } from './locationTypes'

export const ONLINE_LABEL = 'Online'
export const UNCONFIRMED_LABEL = 'Location to be confirmed'

/** Where an event is held, as a card or header says it: a venue, online, or not yet known. */
export type EventPlace = {
  kind: 'venue' | 'online' | 'unconfirmed'
  label: string
}

type PlaceSource = {
  locationType: EventLocationType | null
  locationName: string | null
  /** The event page has it; a card doesn't */
  locationAddress?: string | null
}

/**
 * The place every event shows (#873). A virtual event is online (its venue fields are hidden in
 * the editor, so any left behind are stale). Otherwise the venue name, else the address; with
 * neither, we say the location is to be confirmed rather than show nothing.
 */
export function eventPlace({
  locationType,
  locationName,
  locationAddress,
}: PlaceSource): EventPlace {
  if (locationType === 'virtual') return { kind: 'online', label: ONLINE_LABEL }
  const venue = locationName?.trim() || locationAddress?.trim()
  return venue ? { kind: 'venue', label: venue } : { kind: 'unconfirmed', label: UNCONFIRMED_LABEL }
}
