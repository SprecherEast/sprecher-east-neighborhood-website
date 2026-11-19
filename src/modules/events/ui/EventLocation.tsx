import { ArrowRight } from 'lucide-react'
import React from 'react'

import { Link } from '@/platform/ui'
import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import type { EventDetail } from '../domain/types'

/** The event page's place panel: name, address and a map link. Nothing when there is no place. */
export const EventLocation: React.FC<{
  event: Pick<EventDetail, 'locationName' | 'locationAddress' | 'mapsHref'>
}> = ({ event: { locationName, locationAddress, mapsHref } }) => {
  if (!locationName && !locationAddress) return null

  return (
    <Card as="section" variant="muted" padding="sm" className="mb-8">
      <Text variant="subsection" className="mb-2">
        Location
      </Text>
      {locationName && <p>{locationName}</p>}
      {locationAddress && <p className="text-sm text-muted-foreground">{locationAddress}</p>}
      {mapsHref && (
        <Link
          href={mapsHref}
          variant="action"
          external
          icon={<ArrowRight aria-hidden="true" />}
          iconPosition="end"
          className="mt-2"
        >
          Open in Google Maps
        </Link>
      )}
    </Card>
  )
}
