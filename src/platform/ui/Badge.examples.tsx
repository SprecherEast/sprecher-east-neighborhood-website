import { Ban } from 'lucide-react'

import { Badge, BadgeList, type BadgeProps } from './Badge'
import { defineExample, EXAMPLE_ROW } from './example'

type Variant = NonNullable<BadgeProps['variant']>
type Size = NonNullable<BadgeProps['size']>

// A `Record` over the variants and sizes: one added to `Badge` fails the type-check until listed
const VARIANTS: Record<Variant, string> = {
  category: 'Parks',
  status: 'Cancelled',
  official: 'Official meeting',
  current: 'Next up',
  caution: 'Depends on funding',
  neutral: 'Later',
  open: 'In progress',
  done: 'Done',
  outline: 'Draft',
}
const SIZES: Record<Size, string> = { xs: 'Extra small', sm: 'Small', md: 'Medium' }

export const Default = defineExample({
  purpose: 'A short label, such as the category of a post or an event',
  settings: { label: { kind: 'text', default: 'Parks' } },
  render: ({ label }) => <Badge>{label}</Badge>,
})

export const Variants = defineExample({
  purpose: 'Each variant has its own colors and words, so no state rests on color alone',
  render: () => (
    <div className={EXAMPLE_ROW}>
      {(Object.keys(VARIANTS) as Variant[]).map((variant) => (
        <Badge key={variant} variant={variant}>
          {VARIANTS[variant]}
        </Badge>
      ))}
    </div>
  ),
})

export const Sizes = defineExample({
  purpose: 'Three sizes: `xs` shares a row with a label, `md` stands out among small labels',
  render: () => (
    <div className={EXAMPLE_ROW}>
      {(Object.keys(SIZES) as Size[]).map((size) => (
        <Badge key={size} size={size}>
          {SIZES[size]}
        </Badge>
      ))}
    </div>
  ),
})

export const WithIcon = defineExample({
  purpose: 'An icon before the words, for a state the reader must not miss',
  render: () => (
    <Badge variant="status">
      <Ban aria-hidden="true" />
      Cancelled
    </Badge>
  ),
})

export const InAList = defineExample({
  purpose: 'A row of badges that wraps on a small screen; `plated` sets each on a solid plate',
  of: 'BadgeList',
  settings: {
    plated: {
      kind: 'boolean',
      default: false,
      description: 'For a row over a photo, where a tint would show the picture through',
    },
  },
  render: ({ plated }) => (
    <BadgeList plated={plated}>
      <Badge>Parks</Badge>
      <Badge>Safety</Badge>
      <Badge variant="official">Official meeting</Badge>
    </BadgeList>
  ),
})
