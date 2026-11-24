import { describe, expect, it } from 'vitest'

import { describeEndpoints } from './callbacks.mjs'

const locate = () => 'payload'
const route = (path, method = 'get') => ({ path, method, handler: function named() {} })
const taken = (endpoints) =>
  describeEndpoints(endpoints, locate, { builtIn: true }).map((e) => e.replacedBy?.path ?? null)

describe('which endpoint Payload picks (#1461)', () => {
  it('does not let a fixed path take a path with a parameter, which gets other requests too', () => {
    expect(taken([route('/count'), route('/:id')])).toEqual([null, null])
    expect(taken([route('/x'), route('/:id')])).toEqual([null, null])
    expect(taken([route('/:id'), route('/count')])).toEqual([null, '/:id'])
  })

  it('reads the dots and other symbols of a fixed path as themselves, not as patterns', () => {
    expect(taken([route('/a.b'), route('/axb')])).toEqual([null, null])
    expect(taken([route('/a.b'), route('/a.b')])).toEqual([null, '/a.b'])
    expect(taken([route('/a+'), route('/aa')])).toEqual([null, null])
  })

  it('names an endpoint written as a plain function `handler` inline', () => {
    const handler = { handler() {} }.handler
    const [found] = describeEndpoints([{ path: '/x', method: 'get', handler }], locate, {
      builtIn: true,
    })
    expect(found.name).toBe('inline')
  })
})
