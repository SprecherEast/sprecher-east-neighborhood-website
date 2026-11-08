import type { ImageRef, RichTextValue } from '@/platform/lib'

import type { EventCategoryRef } from './categories'
import type { EventLocationType } from './locationTypes'
import type { OfficialBody } from './officialMeetings'
import type { EventPlace } from './place'

/** What an event card or list item shows. */
export type EventSummary = {
  id: number
  slug: string
  title: string
  /** Day-only date, stored as midnight UTC */
  date: string
  /** Free text in site time, for example "6:00 PM" */
  timeStart: string | null
  timeEnd: string | null
  /** Called off: still listed, and marked as cancelled wherever it shows (#122) */
  cancelled: boolean
  /** Set for a public body's own meeting, marked "Official meeting" wherever it shows (#122) */
  officialBody: OfficialBody | null
  /** The loaded categories, in the order the editor set them */
  categories: EventCategoryRef[]
  description: string | null
  locationName: string | null
  /** The venue, "Online" or "Location to be confirmed": every event shows one (#873) */
  place: EventPlace
  image: ImageRef | null
}

/** Everything the event page shows, including its search-engine fields. */
export type EventDetail = EventSummary & {
  locationType: EventLocationType | null
  locationAddress: string | null
  /** "Open in Google Maps" link (`toMapsHref`) */
  mapsHref: string | null
  registrationUrl: string | null
  /** The official meeting's agenda, an `https://` link; null when the event isn't official */
  agendaUrl: string | null
  content: RichTextValue | null
  meta: {
    title: string | null
    description: string | null
    image: ImageRef | null
  }
}

/** A published event's address and last edit, for static pages and the sitemap. */
export type EventSitemapEntry = {
  slug: string
  updatedAt: string
}
