import {
  ArrowRight,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Clock,
  Landmark,
} from 'lucide-react'
import React from 'react'

import { CERTAINTIES } from '@/platform/lib/certainty'
import { Badge, BadgeList } from '@/platform/ui/Badge'
import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

/** Every variant and size of the badge, and the badges built on it */
export function BadgeGallery() {
  return (
    <GalleryEntry name="Badge">
      <GalleryVariant label="category">
        <BadgeList>
          <Badge>Parks</Badge>
          <Badge variant="category">Community meeting</Badge>
        </BadgeList>
      </GalleryVariant>
      <GalleryVariant label="on-image (on the photo of PageHeader · image)">
        <div className="rounded-2xl bg-scrim p-6">
          <Badge variant="on-image">Events</Badge>
        </div>
      </GalleryVariant>
      <GalleryVariant label="CertaintyBadge: confirmed, estimate, unknown (key facts, chart captions)">
        <BadgeList>
          {CERTAINTIES.map((certainty) => (
            <CertaintyBadge key={certainty} certainty={certainty} />
          ))}
        </BadgeList>
      </GalleryVariant>
      <GalleryVariant label="size md, with open and done (a state mark on the plan, #952)">
        <BadgeList>
          <Badge variant="open" size="md">
            <CircleDot aria-hidden="true" />
            Open
          </Badge>
          <Badge variant="done" size="md">
            <CircleCheck aria-hidden="true" />
            Done
          </Badge>
          <Badge variant="outline">frontend</Badge>
        </BadgeList>
      </GalleryVariant>
      <GalleryVariant label="status (a cancelled event, #122)">
        <Badge variant="status">
          <CircleX aria-hidden="true" />
          Cancelled
        </Badge>
      </GalleryVariant>
      <GalleryVariant label="official (an official meeting, #122)">
        <Badge variant="official">
          <Landmark aria-hidden="true" />
          Official meeting
        </Badge>
      </GalleryVariant>
      <GalleryVariant label="current, caution, neutral (a timeline step, #507)">
        <BadgeList>
          <Badge variant="current">
            <ArrowRight aria-hidden="true" />
            Next up
          </Badge>
          <Badge variant="caution">
            <CircleDashed aria-hidden="true" />
            Depends
          </Badge>
          <Badge variant="neutral">
            <Clock aria-hidden="true" />
            Later
          </Badge>
        </BadgeList>
      </GalleryVariant>
    </GalleryEntry>
  )
}
