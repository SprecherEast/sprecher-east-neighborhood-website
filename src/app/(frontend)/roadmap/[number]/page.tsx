import type { Metadata } from 'next/types'

import { notFound } from 'next/navigation'
import React from 'react'

import { ROADMAP_PATH } from '@/modules/roadmap'
import {
  getPlanIssue,
  IssueList,
  IssueMarkdown,
  LabelBadges,
  listPlanIssueNumbers,
  StateBadge,
} from '@/modules/roadmap/server'
import { NOT_INDEXED } from '@/platform/seo/notIndexed'
import { Link } from '@/platform/ui/Link'
import { PageHeader } from '@/platform/ui/PageHeader'
import { Text } from '@/platform/ui/Text'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

// Same hour as the plan: the page and its issue pages share the cached GitHub reads
export const revalidate = 3600

type Args = { params: Promise<{ number: string }> }

/** A GitHub issue number is plain digits; anything else is not one of ours */
const toNumber = (value: string) => (/^[1-9]\d{0,8}$/.test(value) ? Number(value) : undefined)

const lookup = async ({ params }: Args) => {
  const number = toNumber((await params).number)
  return number === undefined ? undefined : getPlanIssue(number)
}

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
  const children = 'children' in issue ? issue.children : []

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        eyebrow={`Issue ${issue.number}`}
        title={issue.title}
        backLink={{ href: ROADMAP_PATH, label: 'Back to our plan' }}
        facts={[{ label: 'Status', value: <StateBadge state={issue.state} /> }]}
      />
      <div className="container max-w-3xl space-y-8">
        <LabelBadges labels={issue.labels} />
        {issue.description.trim() ? (
          <IssueMarkdown>{issue.description}</IssueMarkdown>
        ) : (
          <Text variant="small">There’s no description for this one yet.</Text>
        )}
        {children.length > 0 && (
          <section className="space-y-2">
            <Text variant="subsection">Issues in this epic</Text>
            <IssueList issues={children} />
          </section>
        )}
        <Link href={issue.url} external variant="inline">
          See it on GitHub
        </Link>
      </div>
    </div>
  )
}

export async function generateMetadata(args: Args): Promise<Metadata> {
  const issue = await lookup(args)
  return { title: issue?.title ?? 'Our plan', robots: NOT_INDEXED }
}
