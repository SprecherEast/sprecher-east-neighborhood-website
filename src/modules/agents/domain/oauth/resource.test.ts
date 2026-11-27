import { describe, expect, it } from 'vitest'

import { mcpResource, resourceMatches, siteOrigin } from './resource'

describe('mcpResource', () => {
  it('is the MCP address on the site origin', () => {
    expect(mcpResource('https://sprechereast.com')).toBe('https://sprechereast.com/api/mcp')
  })

  it('does not double a trailing slash', () => {
    expect(mcpResource('https://sprechereast.com/')).toBe('https://sprechereast.com/api/mcp')
  })
})

describe('resourceMatches', () => {
  const expected = 'https://sprechereast.com/api/mcp'

  it('accepts the MCP address', () => {
    expect(resourceMatches(expected, expected)).toBe(true)
  })

  it.each([
    undefined,
    null,
    '',
    'https://sprechereast.com',
    'https://sprechereast.com/',
    'https://sprechereast.com/api/mcp/',
    'https://sprechereast.com/api/mcp#x',
    'https://sprechereast.com/api/mcp?x=1',
    'https://sprechereast.com/api/graphql',
    'https://other.example/api/mcp',
    'http://sprechereast.com/api/mcp',
    'https://SPRECHEREAST.com/api/mcp',
    'https://sprechereast.com/api/mcp ',
  ])('refuses %s', (resource) => {
    expect(resourceMatches(resource, expected)).toBe(false)
  })

  it('never matches when nothing is expected', () => {
    expect(resourceMatches('', '')).toBe(false)
  })
})

describe('siteOrigin', () => {
  it.each([
    ['https://sprechereast.com', 'https://sprechereast.com'],
    ['https://sprechereast.com/', 'https://sprechereast.com'],
    ['https://sprechereast.com///', 'https://sprechereast.com'],
  ])('spells %s as %s', (given, spelled) => {
    expect(siteOrigin(given)).toBe(spelled)
  })

  it('keeps a slash that is not at the end', () => {
    expect(siteOrigin('https://sprechereast.com/a/b/')).toBe('https://sprechereast.com/a/b')
  })
})
