import { describe, expect, it } from 'vitest'

import { orderField } from './orderField'

describe('orderField', () => {
  it('is a number in the sidebar, 99 until an editor sets it, where lower comes first', () => {
    expect(orderField()).toEqual({
      name: 'order',
      type: 'number',
      defaultValue: 99,
      admin: { position: 'sidebar', description: 'Lower numbers appear first' },
    })
  })

  it('can say what the order is within', () => {
    expect(orderField('Lower numbers appear first within category').admin?.description).toBe(
      'Lower numbers appear first within category',
    )
  })
})
