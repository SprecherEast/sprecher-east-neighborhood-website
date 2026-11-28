import { describe, expect, it } from 'vitest'

import { RETURN_PARAM, safeReturnPath } from './returnPath'

const ALLOWED = ['/oauth/approve'] as const

describe('safeReturnPath', () => {
  it('keeps an allowed page of this site, with its query', () => {
    expect(safeReturnPath('/oauth/approve?client_id=mcp_a&state=s%201', ALLOWED)).toBe(
      '/oauth/approve?client_id=mcp_a&state=s%201',
    )
    expect(safeReturnPath('/oauth/approve', ALLOWED)).toBe('/oauth/approve')
  })

  it.each([
    ['another site', 'https://evil.example/oauth/approve'],
    ['a scheme-relative address', '//evil.example/oauth/approve'],
    ['a backslash the browser reads as a slash', '/\\evil.example/oauth/approve'],
    ['a tab the browser drops from the slashes', '/\t/evil.example/oauth/approve'],
    ['a newline inside the slashes', '/\n/evil.example'],
    ['a page that did not ask', '/account'],
    ['a longer path', '/oauth/approve/extra'],
    ['a look-alike path', '/oauth/approved'],
    ['a dot segment that leaves the page', '/oauth/approve/../../account'],
    ['a script address', 'javascript:alert(1)'],
    ['a relative address', 'oauth/approve'],
    ['nothing', ''],
    ['too long', `/oauth/approve?${'a'.repeat(3000)}`],
  ])('refuses %s', (_name, raw) => {
    expect(safeReturnPath(raw, ALLOWED)).toBeNull()
  })

  it('refuses what is not one string, such as a repeated query name', () => {
    expect(safeReturnPath(['/oauth/approve', '/oauth/approve'], ALLOWED)).toBeNull()
    expect(safeReturnPath(undefined, ALLOWED)).toBeNull()
  })

  it('names the query parameter once', () => {
    expect(RETURN_PARAM).toBe('next')
  })
})
