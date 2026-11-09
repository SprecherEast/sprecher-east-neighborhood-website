import { notFound } from 'next/navigation'
import React from 'react'

import { getPlanIssueFromAddress, IssueDetail } from '@/modules/roadmap/server'
import { RouteDialog } from '@/platform/ui/RouteDialog.client'

// Same hour as the plan and the issue's own page, which shows the same text on a direct visit
export const revalidate = 3600

type Args = { params: Promise<{ number: string }> }

/**
 * An issue opened from the plan shows over it in a dialog (#946). Next.js uses this for a click
 * inside the site; a direct visit or a refresh shows the issue's own page instead.
 */
export default async function PlanIssueDialog({ params }: Args) {
  const issue = await getPlanIssueFromAddress((await params).number)
  if (!issue) notFound()
  return (
    <RouteDialog title={issue.title} backLabel="Back to our plan">
      <IssueDetail issue={issue} />
    </RouteDialog>
  )
}
