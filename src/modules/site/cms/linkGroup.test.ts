import type { ArrayField } from 'payload'
import { describe, expect, it } from 'vitest'

import { linkGroup } from './linkGroup'

describe('linkGroup', () => {
  it('merges overrides into the list of links', () => {
    const field = linkGroup({ overrides: { maxRows: 2 } }) as ArrayField

    expect(field).toMatchObject({ name: 'links', type: 'array', maxRows: 2 })
    expect(field.admin).toEqual({ initCollapsed: true })
    expect(field.fields).toHaveLength(1)
  })
})
