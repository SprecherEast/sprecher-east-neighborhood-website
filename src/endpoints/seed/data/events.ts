/** The categories the seed's events use, by slug, in the tree events share with posts (#362). */
export const eventCategories = {
  meeting: 'Meeting',
  social: 'Social',
  volunteer: 'Volunteer',
  workshop: 'Workshop',
  sports: 'Sports & Recreation',
  community: 'Community',
  family: 'Family',
  other: 'Other',
} as const

type EventItem = {
  title: string
  slug: string
  date: string
  timeStart?: string
  timeEnd?: string
  /** A slug in `eventCategories`: the seed creates those categories first (#362) */
  category: keyof typeof eventCategories
  featured: boolean
  locationType: 'in-person' | 'virtual' | 'hybrid'
  locationName?: string
  locationAddress?: string
  mapsUrl?: string
  description?: string
}

export const eventItems: EventItem[] = [
  {
    title: 'Plan Commission Meeting',
    slug: 'plan-commission-2026-03-02',
    date: '2026-03-02T00:00:00.000Z',
    timeStart: '5:30 PM',
    category: 'meeting',
    featured: true,
    locationType: 'hybrid',
    locationName: 'City-County Building, Room 357 / Virtual via Zoom',
    locationAddress: '210 Martin Luther King Jr. Blvd., Madison, WI 53703',
    mapsUrl: 'https://maps.google.com?q=210+Martin+Luther+King+Jr+Blvd+Madison+WI+53703',
    description:
      'Regular meeting of the Madison Plan Commission. Reviews development proposals, zoning changes, and subdivision plats \u2014 decisions that directly affect new construction and land use in the Sprecher East area.',
  },
  {
    title: 'Common Council Meeting',
    slug: 'common-council-2026-03-10',
    date: '2026-03-10T00:00:00.000Z',
    timeStart: '6:30 PM',
    category: 'meeting',
    featured: true,
    locationType: 'hybrid',
    locationName: 'City-County Building, Room 201',
    locationAddress: '210 Martin Luther King Jr. Blvd., Madison, WI 53703',
    mapsUrl: 'https://maps.google.com?q=210+Martin+Luther+King+Jr+Blvd+Madison+WI+53703',
    description:
      'Regular meeting of the Madison Common Council. District 16 is represented by Alder Sean O\u2019Brien. Meetings are open to the public with options for in-person and virtual attendance.',
  },
  {
    title: 'Common Council Meeting',
    slug: 'common-council-2026-03-24',
    date: '2026-03-24T00:00:00.000Z',
    timeStart: '6:30 PM',
    category: 'meeting',
    featured: false,
    locationType: 'hybrid',
    locationName: 'City-County Building, Room 201',
    locationAddress: '210 Martin Luther King Jr. Blvd., Madison, WI 53703',
    mapsUrl: 'https://maps.google.com?q=210+Martin+Luther+King+Jr+Blvd+Madison+WI+53703',
    description: 'Regular meeting of the Madison Common Council. District 16 is represented by Alder Sean O\u2019Brien.',
  },
  {
    title: 'Prescribed Burns in District 16 Parks (March\u2013May)',
    slug: 'prescribed-burns-district-16-spring-2026',
    date: '2026-03-01T00:00:00.000Z',
    category: 'community',
    featured: false,
    locationType: 'in-person',
    locationName: 'Multiple District 16 Parks',
    description:
      'The City of Madison Parks and Engineering Divisions will conduct prescribed burns from March through May at several District 16 parks: Acewood Conservation Park, Door Creek Park, Elvehjem Sanctuary, Owl Creek Park, and Upper Mud Lake Pond.',
  },
  {
    title: 'MPD Recognition Event',
    slug: 'mpd-recognition-2026-04-22',
    date: '2026-04-22T00:00:00.000Z',
    timeStart: '1:00 PM',
    category: 'community',
    featured: true,
    locationType: 'in-person',
    locationName: 'MPD Training Center',
    locationAddress: '5702 Femrite Dr., Madison, WI 53718',
    mapsUrl: 'https://maps.google.com?q=5702+Femrite+Dr+Madison+WI+53718',
    description:
      'The Madison Police Department holds a recognition event at its Training Center on Femrite Drive. It’s open to the public.',
  },
  {
    title: 'Common Council Meeting',
    slug: 'common-council-2026-04-21',
    date: '2026-04-21T00:00:00.000Z',
    timeStart: '6:30 PM',
    category: 'meeting',
    featured: false,
    locationType: 'hybrid',
    locationName: 'City-County Building, Room 201',
    locationAddress: '210 Martin Luther King Jr. Blvd., Madison, WI 53703',
    mapsUrl: 'https://maps.google.com?q=210+Martin+Luther+King+Jr+Blvd+Madison+WI+53703',
    description: 'Regular meeting of the Madison Common Council. District 16 is represented by Alder Sean O\u2019Brien.',
  },
  {
    title: 'Common Council Meeting',
    slug: 'common-council-2026-05-05',
    date: '2026-05-05T00:00:00.000Z',
    timeStart: '6:30 PM',
    category: 'meeting',
    featured: false,
    locationType: 'hybrid',
    locationName: 'City-County Building, Room 201',
    locationAddress: '210 Martin Luther King Jr. Blvd., Madison, WI 53703',
    mapsUrl: 'https://maps.google.com?q=210+Martin+Luther+King+Jr+Blvd+Madison+WI+53703',
    description: 'Regular meeting of the Madison Common Council. District 16 is represented by Alder Sean O\u2019Brien.',
  },
]
