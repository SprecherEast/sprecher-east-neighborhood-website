import type { Metadata } from 'next/types'

import { notFound } from 'next/navigation'
import React from 'react'

import { ROADMAP_PATH } from '@/modules/roadmap'
import { getMissionFromAddress, listMissionNumbers, MissionPage } from '@/modules/roadmap/server'
import { mergeOpenGraph } from '@/platform/seo/mergeOpenGraph'
import { NOT_INDEXED } from '@/platform/seo/notIndexed'
import { PageHeader } from '@/platform/ui/PageHeader'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

// Same hour as the plan: a mission's page shares the cached GitHub reads
export const revalidate = 3600

type Args = { params: Promise<{ number: string }> }

const lookup = async ({ params }: Args) => getMissionFromAddress((await params).number)

export async function generateStaticParams() {
  try {
    return (await listMissionNumbers()).map((number) => ({ number: String(number) }))
  } catch (error) {
    console.error('[roadmap] generateStaticParams failed; falling back to []', error)
    return []
  }
}

export default async function MissionRoute(args: Args) {
  const found = await lookup(args)
  if (!found) notFound()

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        eyebrow="Mission"
        title={found.mission.title}
        backLink={{ href: ROADMAP_PATH, label: 'What we’re building' }}
      />
      <div className="container max-w-3xl">
        <MissionPage mission={found.mission} now={found.now} />
      </div>
    </div>
  )
}

export async function generateMetadata(args: Args): Promise<Metadata> {
  const found = await lookup(args)
  const title = found ? `${found.mission.title} | What we’re building` : 'What we’re building'
  const description = 'One of our missions, with its projects and issues, straight from our plan.'
  return {
    title,
    description,
    openGraph: mergeOpenGraph({ title, description }),
    robots: NOT_INDEXED,
  }
}
