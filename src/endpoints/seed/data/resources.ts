import type { ResourceCategory } from '@/modules/directory'

type ResourceItem = {
  title: string
  description?: string
  url?: string
  phone?: string
  category: ResourceCategory
  order: number
  links?: { label: string; url: string }[]
  /** Shows the seed's placeholder portrait (never a real photo), with this credit (#393) */
  placeholderPortraitCredit?: string
}

export const resourceItems: ResourceItem[] = [
  // Elected Officials
  {
    title: 'Alder Sean O\u2019Brien \u2014 District 16',
    description:
      'City of Madison alder representing the Sprecher East area. Contact for city issues, development concerns, and neighborhood advocacy.',
    url: 'https://www.cityofmadison.com/council/district16',
    phone: '(608) 572-7560',
    category: 'elected-officials',
    order: 1,
    links: [{ label: 'Alder blog', url: 'https://www.cityofmadison.com/council/district16/blog' }],
    placeholderPortraitCredit: 'Placeholder image, not the alder',
  },
  {
    title: 'Mayor Satya Rhodes-Conway',
    description: 'Mayor of the City of Madison.',
    url: 'https://www.cityofmadison.com/mayor',
    phone: '(608) 266-4611',
    category: 'elected-officials',
    order: 2,
  },
  {
    title: 'Dane County Supervisor Goodwill Obieze \u2014 District 16',
    description:
      'Dane County Board supervisor for the Sprecher East area. County district numbers are separate from Madison\u2019s alder districts, so this is not the same office as the alder.',
    url: 'https://board.danecounty.gov/Supervisors/Detail/16',
    category: 'elected-officials',
    order: 3,
  },
  {
    title: 'State Representative',
    description: 'Wisconsin State Assembly representative for the 48th District.',
    url: 'https://legis.wisconsin.gov/',
    category: 'elected-officials',
    order: 4,
  },

  // Public Safety
  {
    title: 'Madison Police \u2014 East District',
    description:
      'East District police station serving the Sprecher East area. For non-emergency reports and community policing.',
    url: 'https://www.cityofmadison.com/police/east',
    phone: '(608) 266-4887',
    category: 'public-safety',
    order: 1,
  },
  {
    title: 'Emergency Services (911)',
    description: 'For emergencies requiring police, fire, or EMS response. Always call 911 for emergencies.',
    phone: '911',
    category: 'public-safety',
    order: 2,
  },
  {
    title: 'Non-Emergency Police Line',
    description: 'For non-emergency police matters (noise complaints, suspicious activity, etc.).',
    phone: '(608) 255-2345',
    category: 'public-safety',
    order: 3,
  },
  {
    title: 'Madison Fire Department',
    description: 'Fire prevention, inspections, and community safety programs.',
    url: 'https://www.cityofmadison.com/fire',
    phone: '(608) 266-4420',
    category: 'public-safety',
    order: 4,
  },

  // Childcare & Education
  {
    title: 'Elvehjem Elementary School',
    description:
      'Public elementary school near Sprecher East. MMSD assigns schools by address: check yours with Find Your School on madison.k12.wi.us.',
    url: 'https://elvehjem.mmsd.org/',
    phone: '(608) 204-1400',
    category: 'childcare',
    order: 1,
  },
  {
    title: 'Madison Metropolitan School District (MMSD)',
    description: 'Public school district for the City of Madison.',
    url: 'https://www.mmsd.org/',
    phone: '(608) 663-1879',
    category: 'childcare',
    order: 2,
  },
  {
    title: 'Madison Public Library \u2014 Pinney Branch',
    description:
      'Closest public library to Sprecher East. Programs, resources, and community space.',
    url: 'https://www.madisonpubliclibrary.org/locations/pinney',
    phone: '(608) 224-7100',
    category: 'childcare',
    order: 3,
  },

  // Renting & Housing
  {
    title: 'Tenant Resource Center',
    description:
      'Free help for renters with landlord disputes, eviction prevention, security deposit issues, and tenant rights.',
    url: 'https://www.tenantresourcecenter.org/',
    phone: '(608) 257-0006',
    category: 'renting',
    order: 1,
  },
  {
    title: 'City of Madison Building Inspection',
    description: 'Report housing code violations, schedule inspections, and check building permits.',
    url: 'https://www.cityofmadison.com/dpced/bi/',
    phone: '(608) 266-4551',
    category: 'renting',
    order: 2,
  },

  // Parks & Recreation
  {
    title: 'Door Creek Park',
    description:
      'Large park on the eastern edge of the neighborhood with trails, playgrounds, and open space.',
    url: 'https://www.cityofmadison.com/parks/find-a-park/park.cfm?id=1255',
    category: 'parks',
    order: 1,
  },
  {
    title: 'Madison Parks Division',
    description: 'City of Madison parks, trails, shelters, and recreation programs.',
    url: 'https://www.cityofmadison.com/parks',
    phone: '(608) 266-4711',
    category: 'parks',
    order: 2,
  },
  {
    title: 'Elvehjem Sanctuary',
    description: 'Nature preserve near the neighborhood with walking trails and wildlife viewing.',
    url: 'https://www.cityofmadison.com/parks/find-a-park/park.cfm?id=1310',
    category: 'parks',
    order: 3,
  },

  // Community Organizations
  {
    title: 'City of Madison Neighborhood Associations',
    description: 'Directory of all registered neighborhood associations in Madison.',
    url: 'https://www.cityofmadison.com/neighborhoods/profile/neighborhoods.cfm',
    category: 'community',
    order: 1,
  },
  {
    title: 'Report a Problem \u2014 City of Madison',
    description:
      'Online tool to report potholes, streetlight outages, graffiti, abandoned vehicles, and other city service issues.',
    url: 'https://www.cityofmadison.com/reportaproblem',
    category: 'community',
    order: 2,
  },
  {
    title: 'Madison Metro Transit',
    description: 'Bus routes, schedules, and trip planning for Madison area public transit.',
    url: 'https://www.cityofmadison.com/metro',
    phone: '(608) 266-4466',
    category: 'community',
    order: 3,
  },

  // Utilities & Services
  {
    title: 'Madison Water Utility',
    description: 'Water service, billing, and water quality information.',
    url: 'https://www.cityofmadison.com/water',
    phone: '(608) 266-4651',
    category: 'utilities',
    order: 1,
  },
  {
    title: 'Madison Gas and Electric (MGE)',
    description: 'Electric and natural gas utility serving the Madison area.',
    url: 'https://www.mge.com/',
    phone: '(608) 252-7222',
    category: 'utilities',
    order: 2,
  },
  {
    title: 'Streets Division \u2014 Recycling & Trash',
    description:
      'Curbside collection schedules, recycling guidelines, and large item pickup for Madison neighbors.',
    url: 'https://www.cityofmadison.com/streets/recycling/',
    phone: '(608) 246-4532',
    category: 'utilities',
    order: 3,
  },
]
