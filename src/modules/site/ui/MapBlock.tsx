import React from 'react'

import { MapEmbed } from '@/platform/ui/MapEmbed.client'
import { Media } from '@/platform/ui/Media'
import { Section } from '@/platform/ui/Section'
import { Text } from '@/platform/ui/Text'

import type { MapBlockProps } from '../domain/blocks'

/*
 * The map block (#764): the heading over the full row, then the text on the left and a picture of
 * the map on its right, about three eighths of the row from `md` up and level with the text's first
 * line. On a phone the picture sits above the text. A tap on the picture or the button under the
 * text opens the live Google map (`MapEmbed`); with no address the picture and text stand alone.
 */
export function MapBlock({ title, description, embedUrl, preview }: MapBlockProps) {
  return (
    <Section spacing="sm">
      <div className="space-y-6">
        <Text variant="section">{title}</Text>
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
