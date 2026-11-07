import React from 'react'

import { MapEmbed } from '@/platform/ui/MapEmbed.client'
import { Media } from '@/platform/ui/Media'
import { Section } from '@/platform/ui/Section'
import { Text } from '@/platform/ui/Text'

import type { MapBlockProps } from '../domain/blocks'

/*
 * The map block (#764): a small picture of the map beside its text, about a fifth of the page's
 * width from `md` up and above the text before that. A tap on the picture or the button under the
 * text opens the live Google map (`MapEmbed`); with no address the picture and text stand alone.
 */
export function MapBlock({ title, description, embedUrl, preview }: MapBlockProps) {
  return (
    <Section spacing="sm">
      <MapEmbed
        embedUrl={embedUrl}
        title={title}
        actionLabel="View the larger map"
        preview={preview ? <Media resource={preview} imgClassName="h-auto w-full" /> : null}
      >
        <Text variant="section">{title}</Text>
        <Text variant="lead" className="max-w-prose text-base leading-relaxed md:text-lg">
          {description}
        </Text>
      </MapEmbed>
    </Section>
  )
}
