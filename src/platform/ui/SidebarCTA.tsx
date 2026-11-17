import { Button } from './Button'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { Card } from './Card'
import { GlassPanel } from './GlassPanel'
import { Text } from './Text'

/**
 * The call to action in a page's rail: a tinted `Card`, or, on a page with a photo behind it
 * (`glass`, #1268), the shared frosted `GlassPanel` so the photo shows through, its text in the
 * panel's own `on-image` colour.
 */
export const SidebarCTA: React.FC<{
  heading: string
  /** Left out when the heading and button already say it */
  description?: string
  buttonLabel: string
  buttonHref: string
  /** The page has a backdrop photo: draw the card as glass over it */
  glass?: boolean
}> = ({ heading, description, buttonLabel, buttonHref, glass = false }) => {
  const content = (
    <>
      <Text
        variant="subsection"
        as="h3"
        className={cn(description ? 'mb-2' : 'mb-4', glass && 'text-on-image')}
      >
        {heading}
      </Text>
      {/* Muted text on the tinted card is 4.41:1 in light theme, under AA's 4.5:1 (#216) */}
      {description && (
        <Text variant="small" className={cn('mb-4', glass ? 'text-on-image' : 'text-foreground')}>
          {description}
        </Text>
      )}
      <Button href={buttonHref} size="sm">
        {buttonLabel}
      </Button>
    </>
  )

  return glass ? <GlassPanel>{content}</GlassPanel> : <Card variant="tinted">{content}</Card>
}
