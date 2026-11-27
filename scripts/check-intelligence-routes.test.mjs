import { safetyRules } from '../intelligence/runner/lib/safety.mjs'
import { describe, expect, it } from 'vitest'

import { offsetProblems } from './check-intelligence-times.mjs'
import { heldBySafety, routeProblems } from './check-intelligence-routes.mjs'

const rules = safetyRules({ sources: ['police-feed'] })
const registry = new Map([
  ['police-feed', { id: 'police-feed' }],
  ['library', { id: 'library' }],
])
const routes = { accept: 'submitSuggestion', reject: 'reportItem', update: 'reportItem' }
const context = { routes, registry, rules }

const at = (sourceId, extra = {}) => ({
  id: 'case-1',
  input: { sourceId, title: 'Story hour' },
  given: { curation: { decision: 'accept' } },
  expected: { route: 'submitSuggestion' },
  ...extra,
})

describe('heldBySafety', () => {
  it('keeps the stages’ answers a case gives, and counts only an absent one as cleared', () => {
    for (const given of [
      { verification: { safety: true } },
      { curation: { safety: true } },
      { verification: { safety: 'false' } },
      { curation: { safety: null } },
    ])
      expect(heldBySafety(at('library', { given }), context), JSON.stringify(given)).toBe(true)
    const cleared = { verification: { safety: false }, curation: { safety: false } }
    expect(heldBySafety(at('library', { given: cleared }), context)).toBe(false)
    expect(heldBySafety(at('library', { given: {} }), context)).toBe(false)
  })

  it('holds an item whose source is listed, whatever the stages answered, and reads no text', () => {
    expect(heldBySafety(at('police-feed'), context)).toBe(true)
    const answered = at('police-feed', { given: { curation: { safety: false } } })
    expect(heldBySafety(answered, context)).toBe(true)
    expect(heldBySafety(at('library'), context)).toBe(false)
    const crime = { ...at('library'), input: { sourceId: 'library', title: 'A stabbing downtown' } }
    expect(heldBySafety(crime, context)).toBe(false)
  })

  it('holds an item from a source the registry does not know', () => {
    expect(heldBySafety(at('nowhere'), context)).toBe(true)
  })
})

describe('routeProblems', () => {
  it('passes a clean accept that expects a suggestion', () => {
    expect(routeProblems(at('library'), context)).toEqual([])
  })

  it('refuses a suggestion with no accept given, or from a listed source', () => {
    const noAccept = at('library', { given: { curation: { decision: 'needs-review' } } })
    expect(routeProblems(noAccept, context)).toEqual([
      'case-1: a suggestion follows an accept, not needs-review',
    ])
    expect(routeProblems(at('police-feed'), context)[0]).toMatch(/gate holds this accept/)
  })

  it('refuses a suggestion for an accept a given stage answer marks as safety', () => {
    const marked = at('library', {
      given: { curation: { decision: 'accept', safety: true } },
    })
    expect(routeProblems(marked, context)[0]).toMatch(/gate holds this accept/)
    const verify = at('library', {
      given: { curation: { decision: 'accept' }, verification: { safety: true } },
    })
    expect(routeProblems(verify, context)[0]).toMatch(/gate holds this accept/)
  })

  it('leaves a case that expects a report alone', () => {
    expect(
      routeProblems(at('police-feed', { expected: { route: 'reportItem' } }), context),
    ).toEqual([])
  })

  it('follows the routes for a decision, and sends a held accept to reportItem', () => {
    const decided = (sourceId, decision, route) =>
      at(sourceId, { id: 'case-2', expected: { decision, route } })
    expect(routeProblems(decided('library', 'accept', 'submitSuggestion'), context)).toEqual([])
    expect(routeProblems(decided('library', 'reject', 'submitSuggestion'), context)).toEqual([
      'case-2: reject routes to reportItem',
    ])
    expect(routeProblems(decided('police-feed', 'accept', 'reportItem'), context)).toEqual([])
    expect(routeProblems(decided('police-feed', 'accept', 'submitSuggestion'), context)[0]).toMatch(
      /gate holds this accept/,
    )
  })

  it('refuses a safety item that is accepted, and a target the decision does not name', () => {
    const c = at('library', {
      id: 'case-3',
      expected: { decision: 'accept', route: 'submitSuggestion', safety: true, targetId: 'x' },
    })
    expect(routeProblems(c, context)).toEqual([
      'case-3: targetId must be null',
      'case-3: a safety item is never accepted',
    ])
  })

  it('names the known document for a duplicate, update or cancel', () => {
    const c = at('library', {
      id: 'case-4',
      known: { id: 'e1', collection: 'events' },
      expected: {
        decision: 'reject',
        route: 'reportItem',
        targetId: 'e1',
        targetCollection: 'events',
      },
    })
    expect(routeProblems(c, context)).toEqual([
      'case-4: targetId must be null',
      'case-4: targetCollection must be null',
    ])
    const update = { ...c, expected: { ...c.expected, decision: 'update' } }
    expect(routeProblems(update, context)).toEqual([])
  })
})

describe('offsetProblems', () => {
  const at = (startsAt, tags = []) => ({ id: 'c', tags, input: { startsAt } })

  it('accepts the Chicago offset of that day, in winter and summer', () => {
    expect(offsetProblems(at('2026-01-10T18:00:00-06:00'))).toEqual([])
    expect(offsetProblems(at('2026-07-10T18:00:00-05:00'))).toEqual([])
  })

  it('names the right offset for a wrong one, unless the case is tagged wrong-offset', () => {
    expect(offsetProblems(at('2026-07-10T18:00:00-06:00'))).toEqual([
      'c: 2026-07-10T18:00:00-06:00 should use -05:00 in America/Chicago',
    ])
    expect(offsetProblems(at('2026-07-10T18:00:00-06:00', ['wrong-offset']))).toEqual([])
  })
})
