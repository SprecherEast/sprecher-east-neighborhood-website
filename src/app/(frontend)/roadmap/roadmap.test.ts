import { describe, expect, it, vi } from 'vitest'

import { NOT_INDEXED } from '@/platform/seo/notIndexed'

const stub = () => null
const getPlanIssue = vi.fn()
vi.mock('@/modules/roadmap/server', () => ({
  getPlan: vi.fn(),
  getPlanIssue: (n: number) => getPlanIssue(n),
  listPlanIssueNumbers: vi.fn(async () => [10, 11]),
  IssueList: stub,
  IssueMarkdown: stub,
  LabelBadges: stub,
  PlanSummary: stub,
  PlanTree: stub,
  StateBadge: stub,
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

describe('the plan pages', () => {
  it('/roadmap asks not to be indexed or followed', async () => {
    const { metadata } = await import('./page')
    expect(metadata.robots).toEqual(NOT_INDEXED)
  })

  it('an issue page asks not to be indexed or followed, and is named for the issue', async () => {
    getPlanIssue.mockResolvedValue({ number: 11, title: 'Add a page' })
    const { generateMetadata } = await import('./[number]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ number: '11' }) })
    expect(metadata.robots).toEqual(NOT_INDEXED)
    expect(metadata.title).toBe('Add a page')
  })

  it('an issue page answers 404 for a screened, unknown or malformed number', async () => {
    getPlanIssue.mockResolvedValue(undefined)
    const { default: IssuePage } = await import('./[number]/page')
    await expect(IssuePage({ params: Promise.resolve({ number: '999' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
    await expect(IssuePage({ params: Promise.resolve({ number: 'abc' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
  })

  it('builds a page for every issue the plan shows', async () => {
    const { generateStaticParams } = await import('./[number]/page')
    expect(await generateStaticParams()).toEqual([{ number: '10' }, { number: '11' }])
  })
})
