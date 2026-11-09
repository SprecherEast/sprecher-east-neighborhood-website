import type { Metadata } from 'next/types'

import React from 'react'

import { planStats } from '@/modules/roadmap'
import { getPlan, PlanSummary, PlanTree } from '@/modules/roadmap/server'
import { mergeOpenGraph } from '@/platform/seo/mergeOpenGraph'
import { NOT_INDEXED } from '@/platform/seo/notIndexed'
import { PageHeader } from '@/platform/ui/PageHeader'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

// The plan is read from GitHub, so the page is static and re-renders every hour
export const dynamic = 'force-static'
export const revalidate = 3600

const title = 'Our plan'
const description = 'The real plan, straight from GitHub and refreshed every hour.'
const intro = `${description} Open a milestone to see its epics, and an epic to see its issues.`

export default async function RoadmapPage() {
  const plan = await getPlan()
  const now = new Date()
  const stats = planStats(plan, now)

  return (
    <div className={PAGE_SHELL}>
      <PageHeader eyebrow="Roadmap" title="What we’re working on" description={intro} />
      <div className="container max-w-3xl space-y-8">
        {stats.epics > 0 && <PlanSummary stats={stats} generatedAt={plan.generatedAt} />}
        <PlanTree plan={plan} now={now} />
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  title,
  description,
  openGraph: mergeOpenGraph({ title, description }),
  robots: NOT_INDEXED,
}
