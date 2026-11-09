import type { Metadata } from 'next/types'

import { notFound } from 'next/navigation'
import React from 'react'

import { ROADMAP_PATH } from '@/modules/roadmap'
import {
  getPlanIssueFromAddress,
  IssueDetail,
  listPlanIssueNumbers,
  planIssueMetadata,
} from '@/modules/roadmap/server'
import { PageHeader } from '@/platform/ui/PageHeader'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

// Same hour as the plan: the page and its issue pages share the cached GitHub reads
export const revalidate = 3600

type Args = { params: Promise<{ number: string }> }

const lookup = async ({ params }: Args) => getPlanIssueFromAddress((await params).number)

export async function generateStaticParams() {
  try {
    return (await listPlanIssueNumbers()).map((number) => ({ number: String(number) }))
  } catch (error) {
    console.error('[roadmap] generateStaticParams failed; falling back to []', error)
    return []
  }
}

export default async function PlanIssuePage(args: Args) {
  const issue = await lookup(args)
  if (!issue) notFound()

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        eyebrow={`Issue ${issue.number}`}
        title={issue.title}
        backLink={{ href: ROADMAP_PATH, label: 'Back to our plan' }}
      />
      <div className="container max-w-3xl">
        <IssueDetail issue={issue} />
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  return planIssueMetadata((await params).number)
}
