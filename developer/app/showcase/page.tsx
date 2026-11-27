import type { Metadata } from 'next'

import { PAGE_SHELL } from '@/platform/ui/layoutSizes'
import { PageHeader } from '@/platform/ui/PageHeader'

export const metadata: Metadata = { title: 'Component showcase' }

/** The component showcase (a placeholder until its pages land, #1533 and #1534). */
export default function ShowcasePage() {
  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        eyebrow="Component showcase"
        title="Every shared component"
        description="The showcase is on its way. It will show each piece of the site’s UI kit, what it can do, and how it looks in light and dark."
        backLink={{ href: '/', label: 'Developer home' }}
      />
    </div>
  )
}
