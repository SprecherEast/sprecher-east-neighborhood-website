import { ArrowRight, Plus } from 'lucide-react'

import { Button, type ButtonProps } from './Button'
import { defineExample, EXAMPLE_ROW } from './example'
import { Section } from './Section'

type Look = NonNullable<ButtonProps['variant']>
type Inverse = Extract<Look, 'inverse' | 'inverse-outline'>
type Size = NonNullable<ButtonProps['size']>

// A `Record` over the variants: a look added to `Button` fails the type-check until it is listed
const LOOKS: Record<Exclude<Look, Inverse>, string> = {
  primary: 'Join the list',
  secondary: 'See the calendar',
  accent: 'Give feedback',
  'accent-outline': 'Read the plan',
  action: 'Confirm',
  ghost: 'Not now',
}
const SIZES: Record<Exclude<Size, 'icon' | 'icon-sm'>, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
}

export const Default = defineExample({
  purpose: 'The main action on a page: one primary button for each view',
  settings: {
    label: { kind: 'text', default: 'Join the neighborhood list' },
    disabled: { kind: 'boolean', default: false, description: 'Not available right now' },
  },
  render: ({ label, disabled }) => <Button disabled={disabled}>{label}</Button>,
})

export const Looks = defineExample({
  purpose: 'Every look, from the one that stands out most to the quietest',
  render: () => (
    <div className={EXAMPLE_ROW}>
      {(Object.keys(LOOKS) as (keyof typeof LOOKS)[]).map((variant) => (
        <Button key={variant} variant={variant}>
          {LOOKS[variant]}
        </Button>
      ))}
    </div>
  ),
})

export const OnABrandBand = defineExample({
  purpose: 'White fill or white outline, for a button on a brand-colored band',
  render: () => (
    <Section tone="brand" spacing="sm" as="div" className="rounded-2xl">
      <div className={EXAMPLE_ROW}>
        <Button variant="inverse">Sign up</Button>
        <Button variant="inverse-outline">Learn more</Button>
      </div>
    </Section>
  ),
})

export const Sizes = defineExample({
  purpose: 'Three sizes; each is at least 44 px tall, so a thumb can always hit it',
  render: () => (
    <div className={EXAMPLE_ROW}>
      {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((size) => (
        <Button key={size} size={size}>
          {SIZES[size]}
        </Button>
      ))}
    </div>
  ),
})

export const IconOnly = defineExample({
  purpose: 'An icon alone needs a name for screen readers',
  render: () => (
    <div className={EXAMPLE_ROW}>
      <Button size="icon" variant="secondary" aria-label="Add an event">
        <Plus aria-hidden="true" />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Add a photo">
        <Plus aria-hidden="true" />
      </Button>
    </div>
  ),
})

export const WithIcon = defineExample({
  purpose: 'An icon before or after the words, drawn the same size as the text',
  render: () => (
    <div className={EXAMPLE_ROW}>
      <Button iconStart={<Plus aria-hidden="true" />}>Add an event</Button>
      <Button variant="secondary" iconEnd={<ArrowRight aria-hidden="true" />}>
        See the calendar
      </Button>
    </div>
  ),
})

export const AsLink = defineExample({
  purpose: 'With an address it is a link that looks like a button',
  render: () => <Button href="#as-link">See the calendar</Button>,
})

export const ExternalLink = defineExample({
  purpose: 'A link to another site opens in a new tab and says so to screen readers',
  render: () => (
    <Button href="https://example.com" external variant="secondary">
      Visit the city website
    </Button>
  ),
})

export const Disabled = defineExample({
  purpose: 'Not available right now: dimmed, and it does nothing',
  render: () => <Button disabled>Send</Button>,
})

export const FullWidth = defineExample({
  purpose: 'Fills its row, on every screen or on phones only',
  settings: {
    fullWidth: {
      kind: 'choice',
      options: ['true', 'mobile', 'false'],
      default: 'mobile',
      description: '`mobile` is full width below 640 px only',
    },
  },
  render: ({ fullWidth }) => (
    <Button fullWidth={fullWidth === 'mobile' ? 'mobile' : fullWidth === 'true'}>
      Join the neighborhood list
    </Button>
  ),
})
