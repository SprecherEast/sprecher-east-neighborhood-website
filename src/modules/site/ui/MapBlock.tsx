import React from 'react'

import { MapEmbed } from '@/platform/ui/MapEmbed.client'
import { Media } from '@/platform/ui/Media'
import { Section, type SectionPlacement } from '@/platform/ui/Section'
import { Text } from '@/platform/ui/Text'

import type { MapBlockProps } from '../domain/blocks'

/*
 * The map block (#764): the heading, the picture of the map, then the text under it. It fills the
 * width it is given, so where it sits and how wide it is come from the section that holds it
 * (#884), not from this component. A tap on the picture or the button under the text opens the
 * live Google map (`MapEmbed`); with no address the picture and text stand alone.
 */
export function MapBlock({
  title,
  description,
  embedUrl,
  preview,
  placement,
}: MapBlockProps & { placement?: SectionPlacement }) {
  return (
    <Section spacing="sm" placement={placement}>
      <div className="space-y-6">
        <Text variant="section" className="tracking-tight md:text-3xl">
          {title}
        </Text>
        <MapEmbed
          embedUrl={embedUrl}
          title={title}
          actionLabel="View the larger map"
          preview={preview ? <Media resource={preview} imgClassName="h-auto w-full" /> : null}
        >
          <Text variant="lead" className="max-w-prose text-base leading-relaxed md:text-lg">
            {description}
          </Text>
        </MapEmbed>
      </div>
    </Section>
  )
}
