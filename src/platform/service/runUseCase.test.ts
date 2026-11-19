import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import type { ActionResult } from '@/platform/lib'

import { runAction, runUseCase } from './runUseCase'

let log: MockInstance

beforeEach(() => {
  log = vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('runUseCase', () => {
  it('returns what the call returns, logging nothing', async () => {
    expect(await runUseCase('Reading a link', async () => 'invalid', 'pending')).toBe('invalid')
    expect(log).not.toHaveBeenCalled()
  })

  it('returns the fallback and logs the error’s name, never its message', async () => {
    const error = new TypeError('Failed query: select … params: ada@example.com')

    const status = await runUseCase('Reading a link', () => Promise.reject(error), 'pending')

    expect(status).toBe('pending')
    expect(log).toHaveBeenCalledWith('Reading a link failed on the server (TypeError)')
    expect(JSON.stringify(log.mock.calls)).not.toContain('ada@example.com')
  })
})

describe('runAction', () => {
  type Failure = 'wrong-input' | 'server-error'
  const toFailure = (error: unknown): Failure =>
    error instanceof RangeError ? 'wrong-input' : 'server-error'

  it('returns the action’s own result', async () => {
    const result = await runAction(
      'Sign-in',
      async (): Promise<ActionResult<Failure>> => ({ ok: true }),
      toFailure,
    )
    expect(result).toEqual({ ok: true })
    expect(log).not.toHaveBeenCalled()
  })

  it('turns a throw into its failure and logs only a server error', async () => {
    const result = await runAction('Sign-in', () => Promise.reject(new Error('db down')), toFailure)
    expect(result).toEqual({ ok: false, failure: 'server-error' })
    expect(log).toHaveBeenCalledWith('Sign-in failed on the server (Error)')
  })

  it('does not log an expected refusal', async () => {
    const result = await runAction('Sign-in', () => Promise.reject(new RangeError('x')), toFailure)
    expect(result).toEqual({ ok: false, failure: 'wrong-input' })
    expect(log).not.toHaveBeenCalled()
  })
})
