import React from 'react'

import { EventFilters, findEventFilterMenu } from '@/modules/events/server'
import { siteTimeZoneLabel } from '@/platform/lib/timezone'
import { PageHeader } from '@/platform/ui/PageHeader'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

/**
 * What /events and each category's page (/events/category/<slug>) share: the header and the
 * category filters (#122). A layout stays mounted while the reader moves between filters, so the
 * filter row keeps keyboard focus and announces each new count.
 */
export default async function EventsIndexLayout({ children }: { children: React.ReactNode }) {
  const menu = await findEventFilterMenu()

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        eyebrow="Community Calendar"
        title="Community Events"
        description={`Join your neighbors at upcoming events in and around the Sprecher East neighborhood. All times are ${siteTimeZoneLabel()}.`}
      />
      <EventFilters menu={menu} />
      {children}
    </div>
  )
}
