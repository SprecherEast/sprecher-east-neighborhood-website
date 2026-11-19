import {
  Bike,
  Calendar,
  Car,
  CircleDollarSign,
  Clock,
  Construction,
  Footprints,
  Info,
  Landmark,
  MapPin,
  Receipt,
  Users,
  Volume2,
  type LucideIcon,
} from 'lucide-react'

/**
 * The icons an editor can pick for a key fact (#509): a short, curated set for neighborhood
 * stories, so facts look alike across articles. Decorative: the label says what the fact is.
 */
export const FACT_ICONS = {
  info: { label: 'Info', Icon: Info },
  date: { label: 'Date', Icon: Calendar },
  time: { label: 'Time', Icon: Clock },
  money: { label: 'Money', Icon: CircleDollarSign },
  taxes: { label: 'Taxes and fees', Icon: Receipt },
  government: { label: 'Government', Icon: Landmark },
  place: { label: 'Place', Icon: MapPin },
  people: { label: 'People', Icon: Users },
  traffic: { label: 'Traffic', Icon: Car },
  walking: { label: 'Walking', Icon: Footprints },
  biking: { label: 'Biking', Icon: Bike },
  noise: { label: 'Noise', Icon: Volume2 },
  construction: { label: 'Construction', Icon: Construction },
} as const satisfies Record<string, { label: string; Icon: LucideIcon }>

export type FactIcon = keyof typeof FACT_ICONS

export const FACT_ICON_OPTIONS = Object.entries(FACT_ICONS).map(([value, { label }]) => ({
  label,
  value,
}))

export function isFactIcon(value: unknown): value is FactIcon {
  return typeof value === 'string' && Object.hasOwn(FACT_ICONS, value)
}
