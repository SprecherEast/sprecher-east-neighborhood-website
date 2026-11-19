import { cn } from '@/platform/lib/cn'
import { type VariantProps, cva } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import type NextLink from 'next/link'

import { AppLink } from './AppLink'
import { TOUCH_MIN_HEIGHT } from './layoutSizes'
import type { ComponentProps, ReactNode } from 'react'

/**
 * The only component that draws a button (docs/ui/component-set.md). A form's submit, a card's
 * action, "Load more" and a toast's action all place a Button; with `href` it renders a link.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-center font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60 aria-busy:cursor-progress [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-primary-fill text-primary-foreground hover:bg-primary-fill-hover focus-visible:outline-ring',
        // primary-strong text: plain primary is 4.33:1 on surface panels and on the hover tint
        secondary:
          'border border-primary text-primary-strong hover:bg-primary/5 focus-visible:outline-ring',
        accent: 'bg-accent text-accent-foreground hover:bg-accent-dark focus-visible:outline-ring',
        // The accent's outline twin: an inset ring, not a border, so it is as tall as `accent` (#1022)
        'accent-outline':
          'ring-1 ring-inset ring-accent-dark text-foreground hover:bg-accent/15 focus-visible:outline-ring',
        // A small action that wakes up (the check-mark inside a box, #1110): flat and muted while
        // disabled; accent-colored and lifted by a shadow while enabled, the lift only with motion allowed
        action:
          'bg-accent text-accent-foreground hover:bg-accent-dark focus-visible:outline-ring disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 enabled:shadow-md motion-safe:enabled:-translate-y-px motion-safe:transition-[color,background-color,box-shadow,translate]',
        ghost: 'text-foreground hover:bg-surface focus-visible:outline-ring',
        // On a brand band (a data-theme="dark" scope): white fill, or a white outline
        inverse:
          'bg-primary-foreground text-primary-dark hover:bg-primary-foreground/95 focus-visible:outline-primary-foreground',
        'inverse-outline':
          'border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground/5 focus-visible:outline-primary-foreground',
      },
      // Every size is at least 44 px tall on phones (WCAG 2.5.8); `sm` shrinks from lg up
      size: {
        sm: `${TOUCH_MIN_HEIGHT} px-4 text-sm lg:px-3`,
        md: 'min-h-11 px-5 text-base',
        lg: 'min-h-12 px-8 text-base',
        icon: 'size-11 [&_svg]:size-5',
        // Drawn 36 px, tapped as 44: the invisible area reaches 4 px past each side (inside a box)
        'icon-sm':
          'relative size-9 rounded-md [&_svg]:size-5 after:absolute after:-inset-1 after:content-[""]',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
        mobile: 'w-full sm:w-auto',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md', fullWidth: false },
  },
)

type Look = Omit<VariantProps<typeof buttonVariants>, 'fullWidth'> & {
  /** `'mobile'`: full width below 640 px only */
  fullWidth?: boolean | 'mobile'
  className?: string
  children?: ReactNode
  iconStart?: ReactNode
  iconEnd?: ReactNode
  /**
   * Shows a spinner in place of `iconStart` and ignores clicks. It stays focusable
   * (`aria-disabled`, not `disabled`), so keyboard focus isn't lost while the work runs.
   */
  loading?: boolean
}

type ButtonElementProps = Look &
  Omit<ComponentProps<'button'>, keyof Look> & {
    href?: undefined
    external?: never
  }

type ButtonLinkProps = Look &
  Omit<ComponentProps<typeof NextLink>, keyof Look | 'href'> & {
    href: string
    /** Opens in a new tab and tells screen readers so */
    external?: boolean
  }

export type ButtonProps = ButtonElementProps | ButtonLinkProps

export function Button(props: ButtonProps) {
  return props.href === undefined ? <ButtonElement {...props} /> : <ButtonLink {...props} />
}

/** What a loading button or link adds: busy state, a click guard and the spinner. */
function busy<E extends { preventDefault(): void }>(
  loading: boolean,
  onClick?: (event: E) => void,
) {
  if (!loading) return { onClick }
  return {
    'aria-busy': true,
    'aria-disabled': true,
    onClick: (event: E) => event.preventDefault(),
  } as const
}

const spinner = <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />

function ButtonElement({
  variant,
  size,
  fullWidth,
  className,
  children,
  iconStart,
  iconEnd,
  loading = false,
  onClick,
  type = 'button',
  ...rest
}: ButtonElementProps) {
  return (
    <button
      {...rest}
      {...busy(loading, onClick)}
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
    >
      {loading ? spinner : iconStart}
      {children}
      {iconEnd}
    </button>
  )
}

function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  children,
  iconStart,
  iconEnd,
  loading = false,
  onClick,
  external = false,
  ...rest
}: ButtonLinkProps) {
  const props = {
    ...busy(loading, onClick),
    ...(external && { target: '_blank', rel: 'noopener noreferrer' }),
    className: cn(buttonVariants({ variant, size, fullWidth }), className),
  }
  const content = (
    <>
      {loading ? spinner : iconStart}
      {children}
      {iconEnd}
      {external && <span className="sr-only">, opens in a new tab</span>}
    </>
  )

  return (
    <AppLink {...rest} {...props}>
      {content}
    </AppLink>
  )
}
