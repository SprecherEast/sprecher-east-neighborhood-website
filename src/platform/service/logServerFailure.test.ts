import { describe, expect, it, vi } from 'vitest'

import { logServerFailure } from './logServerFailure'

describe('logServerFailure', () => {
  it('logs the action and the error’s name, never its message', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new TypeError('Failed query: select … params: ada@example.com')

    logServerFailure('Sign-in', error)

    expect(log).toHaveBeenCalledWith('Sign-in failed on the server (TypeError)')
    expect(JSON.stringify(log.mock.calls)).not.toContain('ada@example.com')
  })

  it('names what was thrown when it isn’t an Error', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    logServerFailure('Password change', 'ada@example.com')
    expect(log).toHaveBeenCalledWith('Password change failed on the server (string)')
  })
})
