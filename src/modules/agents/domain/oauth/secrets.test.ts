import { describe, expect, it } from 'vitest'

import { TOKEN_PREFIX } from './constants'
import { generateClientId, generateToken, hashToken, tokenKindOf } from './secrets'

describe('generateToken', () => {
  it.each(['code', 'access', 'refresh'] as const)('makes a %s token with its prefix', (kind) => {
    expect(generateToken(kind).startsWith(TOKEN_PREFIX[kind])).toBe(true)
  })

  it('carries 256 bits, URL-safe, and never repeats', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const token = generateToken('access')
      expect(token.slice(TOKEN_PREFIX.access.length)).toMatch(/^[A-Za-z0-9_-]{43}$/)
      seen.add(token)
    }
    expect(seen.size).toBe(50)
  })
})

describe('tokenKindOf', () => {
  it('reads the kind from the prefix', () => {
    expect(tokenKindOf(generateToken('access'))).toBe('access')
    expect(tokenKindOf(generateToken('refresh'))).toBe('refresh')
    expect(tokenKindOf(generateToken('code'))).toBe('code')
  })

  it('knows nothing of an API key or junk', () => {
    expect(tokenKindOf('5f0c1b7e-9c1d-4c1e-8b6a-0a1b2c3d4e5f')).toBeNull()
    expect(tokenKindOf('')).toBeNull()
    expect(tokenKindOf('SEA_abc')).toBeNull()
  })
})

describe('hashToken', () => {
  it('is a stable 64-character hex digest that is not the token', () => {
    const hash = hashToken('sea_example', 'secret-a')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(hashToken('sea_example', 'secret-a'))
    expect(hash).not.toContain('example')
  })

  it('differs by token and by site secret, so a copied database alone proves nothing', () => {
    expect(hashToken('sea_a', 's')).not.toBe(hashToken('sea_b', 's'))
    expect(hashToken('sea_a', 's1')).not.toBe(hashToken('sea_a', 's2'))
  })

  it('refuses an empty secret', () => {
    expect(() => hashToken('sea_a', '')).toThrow()
  })
})

describe('generateClientId', () => {
  it('is a readable, unguessable name', () => {
    const id = generateClientId()
    expect(id).toMatch(/^mcp_[0-9a-f]{32}$/)
    expect(generateClientId()).not.toBe(id)
  })
})
