import { describe, expect, it } from 'vitest'

import {
  effectiveScopes,
  firstMissingScope,
  grantFor,
  isExpired,
  narrowAccess,
  parseRequestedScopes,
  recordAllows,
  requiredScope,
  scopeList,
  scopesOf,
  RESERVED_SCOPES,
  SCOPES,
  toolCallNames,
} from './scopes'

/** Every box ticked: what the plugin's options offer, which a scope can only narrow. */
const CEILING = {
  events: { find: true, create: true, update: true, delete: true },
  posts: { find: true, create: true, update: true, delete: true },
  categories: { find: true, create: true, update: true, delete: true },
  agentRuns: { find: true, create: true, update: true, delete: true },
  'payload-mcp-tool': { submitSuggestion: true, reportItem: true },
}
const NOW = new Date('2026-11-27T12:00:00Z')

describe('narrowAccess', () => {
  it('read finds published content and does nothing else', () => {
    const access = narrowAccess(CEILING, ['read'])
    expect(access.events).toEqual({ find: true, create: false, update: false, delete: false })
    expect(access.posts).toMatchObject({ find: true, create: false })
    expect(access.categories).toMatchObject({ find: true, create: false })
    expect(access.agentRuns).toEqual({ find: false, create: false, update: false, delete: false })
    expect(access['payload-mcp-tool']).toEqual({ submitSuggestion: false, reportItem: false })
  })

  it('suggest gives the two tools and the run log they attach to, and reads nothing else', () => {
    const access = narrowAccess(CEILING, ['suggest'])
    expect(access['payload-mcp-tool']).toEqual({ submitSuggestion: true, reportItem: true })
    expect(access.agentRuns).toEqual({ find: true, create: true, update: true, delete: false })
    expect(access.events).toMatchObject({ find: false })
  })

  it('gives nothing when there are no scopes (fails closed)', () => {
    const access = narrowAccess(CEILING, [])
    const allowed = Object.values(access).flatMap((value) => Object.values(value))
    expect(allowed).not.toContain(true)
  })

  it('never widens: a box that is not ticked stays off whatever the scope', () => {
    const ceiling = {
      ...CEILING,
      events: { find: false },
      'payload-mcp-tool': { reportItem: true },
    }
    const access = narrowAccess(ceiling, [...SCOPES])
    expect(access.events).toMatchObject({ find: false })
    expect(access['payload-mcp-tool']).toEqual({ submitSuggestion: false, reportItem: true })
  })

  it('never lets any scope create, change or delete events, posts or categories', () => {
    for (const scopes of [[...SCOPES], [...RESERVED_SCOPES], ['read'], ['suggest']] as string[][]) {
      const access = narrowAccess(CEILING, scopes)
      for (const key of ['events', 'posts', 'categories'] as const) {
        expect(access[key]).toMatchObject({ create: false, update: false, delete: false })
      }
    }
  })

  it('ignores a scope it does not know, and the reserved publish name grants nothing', () => {
    for (const unknown of ['mcp', 'admin', 'publish', '']) {
      const access = narrowAccess(CEILING, [unknown])
      expect(Object.values(access).flatMap((value) => Object.values(value))).not.toContain(true)
    }
  })

  it('does not read a missing or odd ceiling as a grant', () => {
    expect(narrowAccess({}, ['read']).events).toMatchObject({ find: false })
    expect(
      narrowAccess({ events: 'yes', 'payload-mcp-tool': null }, ['read']).events,
    ).toMatchObject({ find: false })
  })
})

describe('requiredScope and firstMissingScope', () => {
  it('names the scope each tool belongs to', () => {
    expect(requiredScope('findEvents')).toBe('read')
    expect(requiredScope('findCategories')).toBe('read')
    expect(requiredScope('submitSuggestion')).toBe('suggest')
    expect(requiredScope('createAgentRuns')).toBe('suggest')
  })

  it('knows no scope for an unknown tool or a content write the site never offers', () => {
    expect(requiredScope('createEvents')).toBeNull()
    expect(requiredScope('deleteEvents')).toBeNull()
    expect(requiredScope('somethingElse')).toBeNull()
  })

  it('finds the first scope a call needs that the client does not have', () => {
    expect(firstMissingScope(['findEvents'], ['read'])).toBeNull()
    expect(firstMissingScope(['findEvents', 'submitSuggestion'], ['read'])).toBe('suggest')
    expect(firstMissingScope(['submitSuggestion'], [])).toBe('suggest')
    expect(firstMissingScope(['unknownTool'], [])).toBeNull()
  })
})

describe('parseRequestedScopes', () => {
  it('defaults to the minimal set when nothing is asked', () => {
    expect(parseRequestedScopes(undefined)).toEqual({ ok: true, scopes: ['read'] })
    expect(parseRequestedScopes('  ')).toEqual({ ok: true, scopes: ['read'] })
  })

  it('reads a space separated list once each, in a fixed order', () => {
    expect(parseRequestedScopes('suggest read read')).toEqual({
      ok: true,
      scopes: ['read', 'suggest'],
    })
  })

  it('refuses a name that is not ours, wherever it sits in the list', () => {
    for (const raw of ['mcp', 'read admin', 'READ', 'read,suggest']) {
      expect(parseRequestedScopes(raw)).toEqual({ ok: false })
    }
  })

  it('accepts the reserved publish name, so a later rule can use it, but it is never granted', () => {
    expect(parseRequestedScopes('read publish')).toEqual({ ok: true, scopes: ['read', 'publish'] })
    expect(grantFor(['read', 'publish'], ['read', 'suggest'])).toEqual(['read'])
  })
})

describe('grantFor', () => {
  it('grants only what is asked and the client record allows', () => {
    expect(grantFor(['read', 'suggest'], ['read'])).toEqual(['read'])
    expect(grantFor(['read'], ['read', 'suggest'])).toEqual(['read'])
    expect(grantFor(['suggest'], ['read'])).toEqual([])
  })

  it('ignores record values that are not scopes', () => {
    expect(grantFor(['read'], ['read', 'mcp', 'publish'])).toEqual(['read'])
  })
})

describe('recordAllows', () => {
  it('allows a request only when the record covers every scope it names', () => {
    expect(recordAllows(['read'], ['read', 'suggest'])).toBe(true)
    expect(recordAllows(['read', 'suggest'], ['read', 'suggest'])).toBe(true)
    expect(recordAllows(['read', 'suggest'], ['read'])).toBe(false)
  })

  it('refuses an empty request and a name that is not a scope', () => {
    expect(recordAllows([], ['read'])).toBe(false)
    expect(recordAllows(['read', 'publish'], ['read', 'publish'])).toBe(false)
  })
})

describe('scopeList', () => {
  it('reads a space-separated scope value, skipping empty parts', () => {
    expect(scopeList('read  suggest')).toEqual(['read', 'suggest'])
    expect(scopeList('')).toEqual([])
    expect(scopeList(null)).toEqual([])
  })
})

describe('effectiveScopes', () => {
  it('is the overlap of the client record and the token, so a narrowed record applies at once', () => {
    expect(effectiveScopes(['read', 'suggest'], ['read', 'suggest'])).toEqual(['read', 'suggest'])
    expect(effectiveScopes(['read'], ['read', 'suggest'])).toEqual(['read'])
    expect(effectiveScopes(['read', 'suggest'], ['read'])).toEqual(['read'])
    expect(effectiveScopes([], ['read'])).toEqual([])
  })

  it('never produces a name that is not a scope', () => {
    expect(effectiveScopes(['mcp', 'publish'], ['mcp', 'publish'])).toEqual([])
  })
})

describe('scopesOf', () => {
  it('keeps only scope names, and nothing from a value that is not a list', () => {
    expect(scopesOf(['suggest', 'mcp', 'read'])).toEqual(['read', 'suggest'])
    expect(scopesOf(null)).toEqual([])
    expect(scopesOf('read')).toEqual([])
  })
})

describe('toolCallNames', () => {
  const call = (name: unknown) => ({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name },
  })

  it('reads the tool of a call', () => {
    expect(toolCallNames(call('findEvents'))).toEqual(['findEvents'])
  })

  it('reads every call of a batch and ignores other methods', () => {
    expect(
      toolCallNames([call('findEvents'), { method: 'tools/list' }, call('reportItem')]),
    ).toEqual(['findEvents', 'reportItem'])
  })

  it('reads nothing from anything else', () => {
    for (const body of [null, 'x', 3, {}, { method: 'tools/call' }, call(7), [null]]) {
      expect(toolCallNames(body)).toEqual([])
    }
  })
})

describe('isExpired', () => {
  it('is false with no expiry, before it, and true at and after it', () => {
    expect(isExpired(null, NOW)).toBe(false)
    expect(isExpired(undefined, NOW)).toBe(false)
    expect(isExpired('2026-11-28T00:00:00Z', NOW)).toBe(false)
    expect(isExpired('2026-11-27T12:00:00Z', NOW)).toBe(true)
    expect(isExpired(new Date('2026-11-01T00:00:00Z'), NOW)).toBe(true)
  })

  it('counts an unreadable date as expired, never as no expiry', () => {
    expect(isExpired('not a date', NOW)).toBe(true)
  })
})
