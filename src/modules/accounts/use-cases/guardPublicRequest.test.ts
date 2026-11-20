import { describe, expect, it, vi } from 'vitest'

import type * as PlatformLib from '@/platform/lib'

import type { RequestLimits } from '../domain/requestLimits'
import { createRequestGuard } from './guardPublicRequest'

vi.mock('server-only', () => ({}))

// The real counter, counting how many are made
const made = vi.hoisted(() => ({ counters: 0 }))
vi.mock('@/platform/lib', async (importActual) => {
  const actual = await importActual<typeof PlatformLib>()
  return {
    ...actual,
    SlidingWindowCounter: class extends actual.SlidingWindowCounter {
      constructor(...args: ConstructorParameters<typeof actual.SlidingWindowCounter>) {
        super(...args)
        made.counters++
      }
    },
  }
})

const noRobotCheck = { isEnabled: () => false, verify: async () => ({ ok: true as const }) }
const limits: RequestLimits = {
  windowMs: 60_000,
  perConnection: 2,
  siteWide: 3,
  trackedConnections: 10,
}

describe('createRequestGuard', () => {
  it('stops one connection past its limit, then the site past its own', async () => {
    const guard = createRequestGuard('test', limits)
    const ask = (ip: string) => guard({ token: null, ip }, noRobotCheck)
    expect(await ask('1.1.1.1')).toBeNull()
    expect(await ask('1.1.1.1')).toBeNull()
    expect(await ask('1.1.1.1')).toBe('too-many')
    expect(await ask('2.2.2.2')).toBeNull()
    expect(await ask('3.3.3.3')).toBe('too-many')
  })

  it('keeps no site-wide count at all when there is no site-wide limit', async () => {
    made.counters = 0
    const guard = createRequestGuard('test', { ...limits, siteWide: undefined })
    for (let i = 0; i < 50; i++) await guard({ token: null, ip: `9.9.${i}.1` }, noRobotCheck)
    expect(made.counters).toBe(1) // the per-connection counter only
  })
})
