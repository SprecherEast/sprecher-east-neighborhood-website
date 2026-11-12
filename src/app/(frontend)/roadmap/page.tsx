import type { Metadata } from 'next/types'

import React from 'react'

import { planStats } from '@/modules/roadmap'
import { getPlan, PlanSummary, PlanTiles } from '@/modules/roadmap/server'
import { mergeOpenGraph } from '@/platform/seo/mergeOpenGraph'
import { NOT_INDEXED } from '@/platform/seo/notIndexed'
import { PageHeader } from '@/platform/ui/PageHeader'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

// The plan is read from GitHub, so the page is static and re-renders every hour
export const dynamic = 'force-static'
export const revalidate = 3600

const title = 'Our plan'
const description = 'The real plan, straight from GitHub and refreshed every hour.'
const intro = `${description} Pick a mission to see its projects, and a project to see its issues.`

export default async function RoadmapPage() {
  const plan = await getPlan()
  const now = new Date()
  const stats = planStats(plan, now)

  return (
    <div className={PAGE_SHELL}>
      <PageHeader title="What we’re building" description={intro} />
      <div className="container max-w-3xl space-y-8">
        {stats.open + stats.done > 0 && (
          <PlanSummary stats={stats} generatedAt={plan.generatedAt} />
        )}
        <PlanTiles plan={plan} now={now} />
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
