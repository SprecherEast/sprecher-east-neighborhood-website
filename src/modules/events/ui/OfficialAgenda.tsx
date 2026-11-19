import { ExternalLink } from 'lucide-react'
import React from 'react'

import { Link } from '@/platform/ui'
import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import { formatOfficialBody } from '../domain/officialMeetings'
import type { EventDetail } from '../domain/types'

/**
 * An official meeting's panel on its page (#122): whose meeting it is and a link to the body's
 * own agenda. Nothing without an agenda link, since the header already names the body. A
 * cancelled meeting keeps it: agendas often carry the cancellation notice.
 */
export const OfficialAgenda: React.FC<{
  event: Pick<EventDetail, 'officialBody' | 'agendaUrl'>
}> = ({ event: { officialBody, agendaUrl } }) => {
  if (!officialBody || !agendaUrl) return null

  return (
    <Card as="section" variant="muted" padding="sm" className="mb-8">
      <Text variant="subsection" className="mb-2">
        Official meeting
      </Text>
      <p>
        This is a {formatOfficialBody(officialBody)} meeting. Its official agenda has the latest
        details.
      </p>
      <Link
        href={agendaUrl}
        variant="action"
        external
        icon={<ExternalLink aria-hidden="true" />}
        iconPosition="end"
        className="mt-2"
      >
        View the official agenda
      </Link>
    </Card>
  )
}
