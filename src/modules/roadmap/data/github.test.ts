import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchRawPlan, mapIssue, mapMilestone } from './github'

const apiIssue = (number: number, over: Record<string, unknown> = {}) => ({
  number,
  title: `Issue ${number}`,
  body: null,
  state: 'open',
  state_reason: null,
  created_at: '2026-11-02T08:00:00Z',
  closed_at: null,
  updated_at: '2026-11-10T09:00:00Z',
  html_url: `https://github.com/o/r/issues/${number}`,
  labels: [{ name: 'bug' }, 'epic'],
  milestone: { number: 7 },
  ...over,
})

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('mapIssue', () => {
  it('maps the fields we use, with an empty body and label names', () => {
    expect(mapIssue(apiIssue(5))).toEqual({
      number: 5,
      title: 'Issue 5',
      body: '',
      state: 'open',
      stateReason: null,
      createdAt: '2026-11-02T08:00:00Z',
      closedAt: null,
      updatedAt: '2026-11-10T09:00:00Z',
      labels: ['bug', 'epic'],
      milestoneNumber: 7,
      url: 'https://github.com/o/r/issues/5',
    })
  })

  it('has no open date when GitHub gives none', () => {
    expect(mapIssue(apiIssue(5, { created_at: undefined })).createdAt).toBeNull()
  })

  it('has no milestone number when there is none', () => {
    expect(mapIssue(apiIssue(5, { milestone: null })).milestoneNumber).toBeNull()
  })
})

describe('mapMilestone', () => {
  it('maps a milestone, with an empty description', () => {
    expect(
      mapMilestone({ number: 1, title: 'M', description: null, state: 'closed', due_on: null }),
    ).toEqual({ number: 1, title: 'M', description: '', state: 'closed', dueOn: null })
  })

  it('keeps a due date as a day, so it never shows a day early in Central Time', () => {
    const due = (due_on: string) =>
      mapMilestone({ number: 1, title: 'M', state: 'open', due_on }).dueOn
    expect(due('2027-01-30T00:00:00Z')).toBe('2027-01-30T00:00:00.000Z')
    expect(due('2027-01-30T08:00:00Z')).toBe('2027-01-30T00:00:00.000Z')
  })
})

describe('fetchRawPlan', () => {
  it('reads milestones, epics and their sub-issues, skipping pull requests', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/milestones')) {
        return json([{ number: 7, title: 'M', description: 'd', state: 'open', due_on: null }])
      }
      if (url.includes('/sub_issues')) return json([apiIssue(11, { labels: [] })])
      return json([apiIssue(10), apiIssue(12, { pull_request: {} })])
    })
    vi.stubGlobal('fetch', fetchMock)

    const raw = await fetchRawPlan()

    expect(raw.milestones.map((m) => m.number)).toEqual([7])
    expect(raw.epics.map((e) => e.epic.number)).toEqual([10])
    expect(raw.epics[0]?.children.map((c) => c.number)).toEqual([11])
  })

  it('lets Next cache each read for an hour and sends the token when set', async () => {
    vi.stubEnv('GITHUB_READ_TOKEN', 'test-token')
    const fetchMock = vi.fn(() => json([]))
    vi.stubGlobal('fetch', fetchMock)

    await fetchRawPlan()

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { next: unknown }]
    expect(init.next).toEqual({ revalidate: 3600 })
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
  })

  it('sends no Authorization header without a token', async () => {
    vi.stubEnv('GITHUB_READ_TOKEN', '')
    const fetchMock = vi.fn(() => json([]))
    vi.stubGlobal('fetch', fetchMock)

    await fetchRawPlan()

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.headers).not.toHaveProperty('Authorization')
  })

  it('follows pages until a short one', async () => {
    const full = Array.from({ length: 100 }, (_, i) => apiIssue(i + 1, { labels: [] }))
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/milestones')) return json([])
      if (url.includes('/sub_issues')) return json([])
      return json(url.includes('page=2') ? [apiIssue(500)] : full)
    })
    vi.stubGlobal('fetch', fetchMock)

    const raw = await fetchRawPlan()

    expect(raw.epics).toHaveLength(101)
  })

  it('throws, with no body in the message, when GitHub answers an error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ message: 'secret detail' }, 403)))
    await expect(fetchRawPlan()).rejects.toThrow('GitHub answered 403')
  })
})
