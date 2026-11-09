import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NOT_INDEXED } from '@/platform/seo/notIndexed'

const findPlanIssue = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('./getPlan', () => ({ getPlan: vi.fn(async () => ({})) }))
vi.mock('../domain/plan', () => ({ findPlanIssue: (...args: unknown[]) => findPlanIssue(...args) }))

describe('planIssueMetadata', () => {
  beforeEach(() => findPlanIssue.mockReset())

  it('names the tab for the issue and keeps it out of search results', async () => {
    findPlanIssue.mockReturnValue({ number: 11, title: 'Add a page' })
    const { planIssueMetadata } = await import('./planIssueMetadata')
    expect(await planIssueMetadata('11')).toEqual({ title: 'Add a page', robots: NOT_INDEXED })
  })

  it('falls back to the plan title for a screened, unknown or malformed number', async () => {
    findPlanIssue.mockReturnValue(undefined)
    const { planIssueMetadata } = await import('./planIssueMetadata')
    expect(await planIssueMetadata('999')).toEqual({ title: 'Our plan', robots: NOT_INDEXED })
    expect(await planIssueMetadata('abc')).toEqual({ title: 'Our plan', robots: NOT_INDEXED })
  })
})
