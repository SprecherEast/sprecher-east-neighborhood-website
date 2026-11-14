import 'server-only'

import type { RawEpic, RawIssue, RawMilestone } from '../domain/types'

/*
 * Reads the plan from GitHub's REST API (GraphQL is blocked for our tokens). Each request is cached
 * by Next for an hour, so the page and its issue pages share one set of reads. The optional
 * `GITHUB_READ_TOKEN` (read-only, public repo) lifts the limit of 60 unauthenticated reads an hour.
 */
export const PLAN_REVALIDATE_SECONDS = 3600
const DEFAULT_REPO = 'SprecherEast/sprecher-east-neighborhood-website'
const PER_PAGE = 100
const MAX_PAGES = 10

type ApiLabel = string | { name?: string | null }
type ApiIssue = {
  number: number
  title: string
  body?: string | null
  state: string
  state_reason?: string | null
  created_at?: string | null
  closed_at?: string | null
  updated_at?: string | null
  html_url: string
  labels?: ApiLabel[]
  milestone?: { number: number } | null
  pull_request?: unknown
}
type ApiMilestone = {
  number: number
  title: string
  description?: string | null
  state: string
  due_on?: string | null
}

export const mapIssue = (issue: ApiIssue): RawIssue => ({
  number: issue.number,
  title: issue.title,
  body: issue.body ?? '',
  state: issue.state === 'open' ? 'open' : 'closed',
  stateReason: issue.state_reason ?? null,
  createdAt: issue.created_at ?? null,
  closedAt: issue.closed_at ?? null,
  updatedAt: issue.updated_at ?? null,
  labels: (issue.labels ?? []).flatMap((l) => {
    const name = typeof l === 'string' ? l : l.name
    return name ? [name] : []
  }),
  milestoneNumber: issue.milestone?.number ?? null,
  url: issue.html_url,
})

export const mapMilestone = (m: ApiMilestone): RawMilestone => ({
  number: m.number,
  title: m.title,
  description: m.description ?? '',
  state: m.state === 'open' ? 'open' : 'closed',
  // A due date is a day: stored as midnight UTC, the form the site's date helpers read as a day
  dueOn: m.due_on ? `${m.due_on.slice(0, 10)}T00:00:00.000Z` : null,
})

async function get<T>(path: string): Promise<T[]> {
  const repo = process.env.ROADMAP_GITHUB_REPO || DEFAULT_REPO
  const token = process.env.GITHUB_READ_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token && { Authorization: `Bearer ${token}` }),
  }
  const items: T[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const separator = path.includes('?') ? '&' : '?'
    const url = `https://api.github.com/repos/${repo}${path}${separator}per_page=${PER_PAGE}&page=${page}`
    const response = await fetch(url, { headers, next: { revalidate: PLAN_REVALIDATE_SECONDS } })
    // Only the status: an error body is never logged or thrown
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
    const batch = (await response.json()) as T[]
    items.push(...batch)
    if (batch.length < PER_PAGE) break
  }
  return items
}

/** The milestones, the epics, and each epic's sub-issues, as GitHub holds them */
export async function fetchRawPlan(): Promise<{ milestones: RawMilestone[]; epics: RawEpic[] }> {
  const [milestones, epicIssues] = await Promise.all([
    get<ApiMilestone>('/milestones?state=all'),
    get<ApiIssue>('/issues?labels=epic&state=all'),
  ])
  const epics = await Promise.all(
    epicIssues
      .filter((i) => !i.pull_request)
      .map(async (epic) => ({
        epic: mapIssue(epic),
        children: (await get<ApiIssue>(`/issues/${epic.number}/sub_issues`))
          .filter((i) => !i.pull_request)
          .map(mapIssue),
      })),
  )
  return { milestones: milestones.map(mapMilestone), epics }
}
