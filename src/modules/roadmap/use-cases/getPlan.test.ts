import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../data/github', () => ({ fetchRawPlan: vi.fn() }))

import { fetchRawPlan } from '../data/github'
import { loadPlan } from './getPlan'

const raw = {
  milestones: [{ number: 1, title: 'M', description: '', state: 'open' as const, dueOn: null }],
  epics: [
    {
      epic: {
        number: 10,
        title: 'E',
        body: '',
        state: 'open' as const,
        stateReason: null,
        closedAt: null,
        updatedAt: null,
        labels: ['epic'],
        milestoneNumber: 1,
        url: 'https://github.com/o/r/issues/10',
      },
      children: [],
    },
  ],
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('loadPlan', () => {
  it('builds the plan from what GitHub holds', async () => {
    vi.mocked(fetchRawPlan).mockResolvedValue(raw)
    expect((await loadPlan()).milestones).toHaveLength(1)
  })

  it('throws at run time, so the last good page stays up', async () => {
    vi.mocked(fetchRawPlan).mockRejectedValue(new Error('GitHub answered 403'))
    await expect(loadPlan()).rejects.toThrow('GitHub answered 403')
  })

  it('gives an empty plan while building, so a deploy never fails on GitHub', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(fetchRawPlan).mockRejectedValue(new Error('GitHub answered 403'))
    expect(await loadPlan()).toMatchObject({ milestones: [], unscheduled: [], hiddenCount: 0 })
  })
})
