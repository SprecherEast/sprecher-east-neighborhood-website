import { describe, expect, it } from 'vitest'

import { buildModel } from './model.mjs'
import { searchNodes } from './search.mjs'
import { TEST_GRAPH } from './testGraph.mjs'

const model = buildModel(TEST_GRAPH)

describe('searchNodes (#1463)', () => {
  it('finds by name, best match first', () => {
    expect(searchNodes(model, 'venues')[0].id).toBe('collection:venues')
  })

  it('finds by alias and says so', () => {
    const [hit] = searchNodes(model, 'calendar')
    expect(hit).toEqual({ id: 'module:events', why: 'alias: calendar' })
  })

  it('finds by path, route and field name', () => {
    expect(searchNodes(model, 'cms/events.ts').map((h) => h.id)).toContain('collection:events')
    expect(searchNodes(model, '/events').map((h) => h.id)).toContain('screen:/events')
    expect(searchNodes(model, 'venue').find((h) => h.id === 'collection:events').why).toBe(
      'field: venue',
    )
    expect(searchNodes(model, 'relationship')).toEqual([])
  })

  it('finds by content type', () => {
    expect(searchNodes(model, 'platform-area').map((h) => h.id)).toEqual(['platform-area:ui'])
  })

  it('needs every word, ignores case, and gives nothing for nothing', () => {
    expect(searchNodes(model, 'EVENTS news')).toEqual([])
    expect(searchNodes(model, '   ')).toEqual([])
  })

  it('caps the list', () => {
    expect(searchNodes(model, 'e', 2)).toHaveLength(2)
  })
})
