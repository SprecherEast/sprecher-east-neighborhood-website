import React from 'react'

import { cn } from '@/platform/lib/cn'
import { RichText } from '@/platform/richtext/RichText'
import { Button } from '@/platform/ui'
import { Section } from '@/platform/ui/Section'

import type { CallToActionBlockProps } from '../domain/blocks'
import { READING_WIDTH } from '@/platform/ui/layoutSizes'

/** The call-to-action band (B13): its text, then its buttons; centred on phones. */
export function CallToActionBlock({ body, links }: CallToActionBlockProps) {
  return (
    <Section tone="brand" spacing="md">
      <div className="flex flex-col items-center gap-8 text-center md:flex-row md:gap-12 md:text-left">
        <div className={cn(READING_WIDTH, 'flex-1')}>
          {/* White text on the band, links too: the theme's link colour is for page backgrounds */}
          {body && (
            <RichText
              className="mb-0 text-primary-foreground [&_a]:text-primary-foreground [&_a:focus-visible]:outline-primary-foreground [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:text-primary-foreground [&_h3]:text-2xl [&_h3]:font-bold [&_h3]:text-primary-foreground [&_p]:text-lg [&_p]:text-primary-foreground/90 [&_strong]:text-primary-foreground"
              data={body}
              enableGutter={false}
            />
          )}
        </div>
        {links.length > 0 && (
          <div className="flex shrink-0 flex-col gap-4 sm:flex-row">
            {links.map((link, i) => (
              // A brand band: white fill first, then a white outline (the CMS look is for page backgrounds)
              <Button
                key={i}
                href={link.href}
                external={link.external}
                size="lg"
                variant={i === 0 ? 'inverse' : 'inverse-outline'}
              >
                {link.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
