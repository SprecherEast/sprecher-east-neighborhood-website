import React from 'react'
import { ExternalLink, Phone } from 'lucide-react'

import { Link } from '@/platform/ui'
import { Card, CardFooter, CardTitle } from '@/platform/ui/Card'
import { ImageCredit } from '@/platform/ui/ImageCredit'
import { Media } from '@/platform/ui/Media'
import { Text } from '@/platform/ui/Text'

import { resourcePortrait } from '../domain/resourcePortrait'
import { isResourceUrl } from '../domain/resourceUrl'
import type { ResourceSummary } from '../domain/types'

/**
 * One entry in the resources directory: its name, what it is, and how to reach it. An elected
 * official's card can also show their portrait, with its credit (#393).
 */
export function ResourceCard({ resource }: { resource: ResourceSummary }) {
  const portrait = resourcePortrait(resource)
  const links = (resource.links ?? []).filter(({ url }) => isResourceUrl(url))

  const title = <CardTitle className="mb-1.5 text-base">{resource.title}</CardTitle>

  return (
    <Card as="article" className="flex flex-col">
      {portrait ? (
        <div className="mb-3 flex items-start gap-4">
          <Media
            resource={portrait}
            size="96px"
            className="shrink-0"
            pictureClassName="block size-24 overflow-hidden rounded-2xl bg-surface"
            imgClassName="size-full object-cover object-top"
          />
          <div className="min-w-0">
            {title}
            <ImageCredit image={portrait} />
          </div>
        </div>
      ) : (
        title
      )}
      {resource.description && (
        <Text variant="small" className="mb-3">
          {resource.description}
        </Text>
      )}
      <CardFooter className="pt-0">
        {resource.url && (
          <Link
            href={resource.url}
            variant="action"
            external
            icon={<ExternalLink aria-hidden="true" />}
          >
            Visit Website
          </Link>
        )}
        {links.map(({ id, label, url }) => (
          <Link
            key={id ?? url}
            href={url}
            variant="action"
            external
            icon={<ExternalLink aria-hidden="true" />}
          >
            {label}
          </Link>
        ))}
        {resource.phone && (
          <Link href={`tel:${resource.phone}`} variant="action" icon={<Phone aria-hidden="true" />}>
            {resource.phone}
          </Link>
        )}
      </CardFooter>
    </Card>
  )
}
