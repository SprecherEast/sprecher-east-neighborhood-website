import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { createElement } from 'react'

import { linkNode, p, paragraph, root, text, heading } from '@/endpoints/seed/helpers/lexical'
import type { ImageRef, RichTextValue } from '@/platform/lib'
import type { KeyFact } from '@/platform/richtext/editorial/keyFacts'
import type { BreadcrumbItem } from '@/platform/ui/Breadcrumbs'
import type { LegendItem, LegendSwatchItem } from '@/platform/ui/Legend'
import type { IconMetaItem, LabelledMetaItem } from '@/platform/ui/MetaList'
import type { SelectOption } from '@/platform/ui'
import samplePhoto from '@/endpoints/seed/image-hero1.webp'
import whitePhoto from '@/endpoints/seed/image-white-test.webp'

/*
 * Fixed sample props for the component gallery (#466): no database, no network, so a change in a
 * shared component is the only thing that changes the page.
 */

/** A day-only date, as Payload stores it (midnight UTC), and a date with a time */
export const SAMPLE_DAY = '2026-03-03T00:00:00.000Z'
export const SAMPLE_DATE_TIME = '2026-07-04T23:30:00.000Z'

export const SAMPLE_FACTS: LabelledMetaItem[] = [
  { label: 'Date', value: 'Saturday, July 4' },
  { label: 'Time', value: '6:30 PM' },
  { label: 'Place', value: 'Sprecher Park shelter' },
]

const icon = (Icon: typeof MapPin) => createElement(Icon, { 'aria-hidden': true })

export const SAMPLE_ICON_FACTS: IconMetaItem[] = [
  { icon: icon(CalendarDays), value: 'Saturday, July 4' },
  { icon: icon(Clock), value: '6:30 PM' },
  { icon: icon(MapPin), value: 'Sprecher Park shelter' },
]

export const SAMPLE_OPTIONS: readonly SelectOption[] = [
  { label: 'Parks and green space', value: 'parks' },
  { label: 'Traffic and streets', value: 'traffic' },
  { label: 'Events', value: 'events' },
]

export const SAMPLE_BREADCRUMBS: BreadcrumbItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Events', href: '/events' },
  { label: 'Summer picnic' },
]

/** A long linked crumb in the middle and a long last title, the tightest a trail can get */
export const SAMPLE_BREADCRUMBS_TIGHT: BreadcrumbItem[] = [
  { label: 'Home', href: '/' },
  { label: 'A category with a very long name', href: '/posts' },
  { label: 'A title written before the limit existed, long enough to run past the edge' },
]

/** A title from before the length limit (#633), so the trail shows how a long one is cut */
export const SAMPLE_BREADCRUMBS_LONG: BreadcrumbItem[] = [
  { label: 'Home', href: '/' },
  { label: 'News', href: '/posts' },
  { label: 'A title written before the limit existed, long enough to run past the edge' },
]

/** Markers for the `Legend` sample: the numbers come from the order, as on an annotated image */
export const SAMPLE_LEGEND_ITEMS: LegendItem[] = [
  { label: 'North entrance', text: 'Traffic from the north joins the freeway here.' },
  { label: 'South entrance', text: 'The matching ramp for traffic from the south.' },
  { label: 'Eastbound ramp', text: null },
  { label: 'Westbound ramp', text: 'Meets the crossing road at a roundabout.' },
]

/** Swatches for the `Legend` sample under a chart: a colour per slot, a hatch on the "more" part */
export const SAMPLE_LEGEND_SWATCHES: LegendSwatchItem[] = [
  { label: 'Borrowed', text: '$179.8M', slot: 1 },
  { label: 'Other money', text: '$92.4M', slot: 2 },
  { label: 'Added in 2027', text: '+$24.8M', slot: 2, pattern: 'hatch' },
  { label: 'Fees and charges', text: null, slot: 3 },
  { label: 'State and federal aid', text: null, slot: 4 },
  { label: 'Savings', text: null, slot: 5, pattern: 'hatch' },
  { label: 'Everything else', text: null, slot: 6 },
]

/** An image as the media collection stores it, pointing at a file bundled with the site */
export const SAMPLE_IMAGE: ImageRef = {
  id: 0,
  alt: 'Blurred streaks of blue and orange light (a sample image)',
  url: samplePhoto.src,
  width: samplePhoto.width,
  height: samplePhoto.height,
  mimeType: 'image/webp',
  credit: 'Sample Photographer',
  license: 'cc-by',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  sourceUrl: 'https://example.com/photo',
  // Empty, so the URL gets no cache-busting query: next/image allows bundled files without one
  updatedAt: '',
  createdAt: '',
}

/** The worst case for text on a photo: pure white (#572) */
export const SAMPLE_WHITE_IMAGE: ImageRef = {
  ...SAMPLE_IMAGE,
  alt: 'A plain white image (a sample for checking text on bright photos)',
  url: whitePhoto.src,
  width: whitePhoto.width,
  height: whitePhoto.height,
}

export const SAMPLE_PHOTO = samplePhoto

// A figure's caption as an editor writes it in the Media collection's caption field
export const SAMPLE_CAPTION_RICH_TEXT = root([
  p('A sample diagram. Source: a made-up agency, with numbers added for this neighborhood guide.'),
]) as unknown as RichTextValue

// The seed's Lexical helpers type nodes loosely (as Payload's field type does), so the result is
// asserted to the renderer's type, as the seed's own documents are when Payload stores them
export const SAMPLE_RICH_TEXT = root([
  heading('h2', 'A heading inside rich text'),
  p('Rich text is what editors write in the CMS. This paragraph shows the body size and spacing.'),
  paragraph(
    text('It can hold '),
    linkNode('a link to another page', '/events'),
    text(' and '),
    linkNode('one that opens in a new tab', 'https://example.com', { newTab: true }),
    text('.'),
  ),
  heading('h3', 'A smaller heading'),
  p('A second paragraph under it.'),
]) as RichTextValue

/**
 * Key facts: the first has an explanation, the second the longest label (60 characters) and the
 * longest explanation (90) the editor allows, the third none
 */
export const SAMPLE_KEY_FACTS: KeyFact[] = [
  {
    value: '2040s',
    label: 'Earliest construction',
    detail: 'Only if the funding comes through.',
    icon: 'date',
    certainty: 'estimate',
    source: null,
  },
  {
    value: '$10M',
    label: 'total cost of the whole project including each phase, in all',
    detail:
      'No price has been published, so this is the City’s earlier share, not the ramps’ cost.',
    icon: 'money',
    certainty: 'unknown',
    source: null,
  },
  {
    value: 'None',
    label: 'Tax increase',
    detail: null,
    icon: 'taxes',
    certainty: 'confirmed',
    source: {
      href: 'https://example.com',
      label: 'City budget',
      external: true,
      appearance: 'default',
    },
  },
]

export const SAMPLE_CODE = `export function greet(name: string) {
  return \`Hello, \${name}!\`
}`
