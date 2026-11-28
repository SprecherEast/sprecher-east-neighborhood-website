import { describe, expect, it } from 'vitest'

import { redirectBack, redirectError } from './redirects'

const ISSUER = 'https://sprechereast.com'

describe('redirectBack', () => {
  it('adds the answer and the issuer to the redirect address', () => {
    const url = new URL(redirectBack('https://claude.ai/cb', ISSUER, { code: 'abc', state: 's1' }))
    expect(url.origin + url.pathname).toBe('https://claude.ai/cb')
    expect(url.searchParams.get('code')).toBe('abc')
    expect(url.searchParams.get('state')).toBe('s1')
    expect(url.searchParams.get('iss')).toBe(ISSUER)
  })

  it('keeps a query the client registered, and encodes what it adds', () => {
    const url = new URL(redirectBack('http://127.0.0.1:9/cb?x=1', ISSUER, { state: 'a&b=c' }))
    expect(url.searchParams.get('x')).toBe('1')
    expect(url.searchParams.get('state')).toBe('a&b=c')
    expect(url.searchParams.getAll('b')).toEqual([])
  })

  it('leaves out an answer that was not given', () => {
    expect(redirectBack('https://claude.ai/cb', ISSUER, { state: undefined })).not.toContain(
      'state',
    )
  })

  it('cannot be turned to another address by the answer', () => {
    const url = new URL(redirectBack('https://claude.ai/cb', ISSUER, { state: '//evil.example' }))
    expect(url.host).toBe('claude.ai')
  })
})

describe('redirectError', () => {
  it('sends the code and description back with the state', () => {
    const url = new URL(
      redirectError(
        'https://claude.ai/cb',
        ISSUER,
        { code: 'access_denied', description: 'No.' },
        's1',
      ),
    )
    expect(url.searchParams.get('error')).toBe('access_denied')
    expect(url.searchParams.get('error_description')).toBe('No.')
    expect(url.searchParams.get('state')).toBe('s1')
  })
})
