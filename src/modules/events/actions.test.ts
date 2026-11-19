import { beforeEach, describe, expect, it, vi } from 'vitest'

const findEventsAfter = vi.hoisted(() =>
  vi.fn(async () => ({ docs: [], nextCursor: null, totalDocs: 0 })),
)
vi.mock('./use-cases/findEventsAfter', () => ({ findEventsAfter }))

// One category, Civic (id 3); the action looks a slug up directly, never through the whole menu
const findCategoryIdBySlug = vi.hoisted(() =>
  vi.fn(async (slug: string) => (slug === 'civic' ? 3 : null)),
)
const findEventFilterMenu = vi.hoisted(() => vi.fn())
vi.mock('./data/categories', () => ({ findCategoryIdBySlug, findEventFilterMenu }))

import { loadMoreEvents } from './actions'

const CURSOR = '2026-10-19T00:00:00.000Z|42'
const AFTER = { key: '2026-10-19T00:00:00.000Z', id: 42 }

beforeEach(() => {
  findEventsAfter.mockClear()
  findCategoryIdBySlug.mockClear()
  findEventFilterMenu.mockClear()
})

describe('loadMoreEvents', () => {
  it('passes a valid scope and cursor to the use case', async () => {
    await loadMoreEvents('past', CURSOR)
    expect(findEventsAfter).toHaveBeenCalledWith('past', AFTER)
  })

  it('loads every event when the filter is null', async () => {
    await loadMoreEvents('upcoming', CURSOR, null)
    expect(findEventsAfter).toHaveBeenCalledWith('upcoming', AFTER)
    expect(findCategoryIdBySlug).not.toHaveBeenCalled()
  })

  it('keeps the filter: passes the id of the category found for its slug (#122)', async () => {
    await loadMoreEvents('upcoming', CURSOR, 'civic')
    expect(findEventsAfter).toHaveBeenCalledWith('upcoming', AFTER, 3)
    // One lookup of the slug, not the whole filter row, on every click
    expect(findCategoryIdBySlug).toHaveBeenCalledOnce()
    expect(findEventFilterMenu).not.toHaveBeenCalled()
  })

  it.each([
    ['a page number instead of a cursor', 'upcoming', 2],
    ['a bad date', 'upcoming', '2026-02-30T00:00:00.000Z|1'],
    ['an extra field', 'upcoming', `${CURSOR}|1`],
    ['a cursor that is too long', 'upcoming', `${CURSOR}${'0'.repeat(64)}`],
    ['a Payload query', 'upcoming', { date: { exists: true } }],
    ['an unknown scope', 'all', CURSOR],
  ])('refuses %s without querying', async (_label, scope, cursor) => {
    await expect(loadMoreEvents(scope, cursor)).rejects.toThrow('Invalid request')
    expect(findEventsAfter).not.toHaveBeenCalled()
  })

  it.each<[string, unknown]>([
    ['a slug no category has', 'family'],
    ['a category id', 3],
    ['a Payload query', { in: [3] }],
    ['an undefined filter sent explicitly as a string', 'undefined'],
  ])('refuses a filter that is %s', async (_label, category) => {
    await expect(loadMoreEvents('upcoming', CURSOR, category)).rejects.toThrow('Invalid request')
    expect(findEventsAfter).not.toHaveBeenCalled()
  })

  it('refuses a malformed filter before reading the categories', async () => {
    await expect(loadMoreEvents('upcoming', CURSOR, 'Civic; drop')).rejects.toThrow(
      'Invalid request',
    )
    expect(findCategoryIdBySlug).not.toHaveBeenCalled()
  })
})
