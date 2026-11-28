import { describe, expect, it } from 'vitest'

import { checkRegisteredRedirectUri, clientAccepts, redirectUriMatches } from './redirectUri'
import type { OAuthClient } from './types'

describe('checkRegisteredRedirectUri', () => {
  it.each([
    'https://claude.ai/api/mcp/auth_callback',
    'https://example.com/callback?x=1',
    'http://127.0.0.1/callback',
    'http://127.0.0.1:33418/callback',
    'http://localhost:8080/cb',
    'http://[::1]:9000/cb',
  ])('accepts %s', (uri) => {
    expect(checkRegisteredRedirectUri(uri)).toBeNull()
  })

  it.each([
    ['', 'not an address'],
    ['claude.ai/callback', 'not an address'],
    ['http://claude.ai/callback', 'plain http off loopback'],
    ['http://127.0.0.1.evil.com/cb', 'a lookalike host'],
    ['http://localhost.evil.com/cb', 'a lookalike host'],
    ['javascript:alert(1)', 'script scheme'],
    ['myapp://callback', 'custom scheme'],
    ['data:text/html,x', 'data scheme'],
    ['https://example.com/cb#frag', 'a fragment'],
    ['https://example.com/cb#', 'an empty fragment'],
    ['https://user:pw@example.com/cb', 'credentials in the address'],
    ['https://*.example.com/cb', 'a wildcard'],
    ['https://example.com/*', 'a wildcard'],
    ['https://example.com', 'no path'],
  ])('refuses %s (%s)', (uri) => {
    expect(checkRegisteredRedirectUri(uri)).not.toBeNull()
  })
})

describe('redirectUriMatches', () => {
  const registered = ['https://claude.ai/api/mcp/auth_callback', 'http://127.0.0.1/callback']

  it('matches a registered address exactly', () => {
    expect(redirectUriMatches(registered, 'https://claude.ai/api/mcp/auth_callback')).toBe(true)
  })

  it.each([
    'https://claude.ai/api/mcp/auth_callback/',
    'https://claude.ai/api/mcp/auth_callback?x=1',
    'https://claude.ai/api/mcp/auth_callback#x',
    'https://claude.ai/api/mcp/auth_callbac',
    'https://CLAUDE.ai/api/mcp/auth_callback',
    'https://claude.ai.evil.com/api/mcp/auth_callback',
    'https://evil.com/?https://claude.ai/api/mcp/auth_callback',
    'http://claude.ai/api/mcp/auth_callback',
    'https://claude.ai:8443/api/mcp/auth_callback',
    ' https://claude.ai/api/mcp/auth_callback',
    '',
  ])('refuses %s', (uri) => {
    expect(redirectUriMatches(registered, uri)).toBe(false)
  })

  it('lets a loopback client choose its port, and only the port', () => {
    expect(redirectUriMatches(registered, 'http://127.0.0.1:51234/callback')).toBe(true)
    expect(redirectUriMatches(registered, 'http://127.0.0.1:51234/other')).toBe(false)
    expect(redirectUriMatches(registered, 'http://127.0.0.1:51234/callback?a=1')).toBe(false)
    expect(redirectUriMatches(registered, 'http://localhost:51234/callback')).toBe(false)
    expect(redirectUriMatches(registered, 'https://127.0.0.1:51234/callback')).toBe(false)
  })

  it('does not accept a loopback address written in another way than registered', () => {
    expect(redirectUriMatches(registered, 'http:127.0.0.1:51234/callback')).toBe(false)
    expect(redirectUriMatches(registered, 'HTTP://127.0.0.1:51234/callback')).toBe(false)
    expect(redirectUriMatches(registered, 'http://127.0.0.1:51234/callback#x')).toBe(false)
    expect(redirectUriMatches(registered, 'http://user@127.0.0.1:51234/callback')).toBe(false)
  })

  it('only matches a loopback address registered as plain http', () => {
    expect(redirectUriMatches(['https://127.0.0.1/callback'], 'http://127.0.0.1:5/callback')).toBe(
      false,
    )
    expect(redirectUriMatches(['http://example.com/cb'], 'http://example.com:5/cb')).toBe(false)
  })

  it('does not let a non-loopback address choose its port', () => {
    expect(redirectUriMatches(['https://example.com/cb'], 'https://example.com:444/cb')).toBe(false)
  })

  it('matches nothing when nothing is registered', () => {
    expect(redirectUriMatches([], 'https://claude.ai/api/mcp/auth_callback')).toBe(false)
  })
})

describe('clientAccepts', () => {
  const CALLBACK = 'https://claude.ai/api/mcp/auth_callback'
  const client: OAuthClient = {
    id: 1,
    clientId: 'mcp_a',
    name: 'Claude',
    redirectUris: [CALLBACK],
    enabled: true,
    agentId: 9,
  }

  it('accepts a client that is on and a redirect address that is one of its own', () => {
    expect(clientAccepts(client, CALLBACK)).toBe(true)
  })

  it.each([
    ['no client', null, CALLBACK],
    ['a client switched off', { ...client, enabled: false }, CALLBACK],
    ['another address', client, 'https://evil.example/cb'],
    ['an address with a trailing slash', client, `${CALLBACK}/`],
  ])('refuses %s', (_name, who, uri) => {
    expect(clientAccepts(who, uri)).toBe(false)
  })
})
