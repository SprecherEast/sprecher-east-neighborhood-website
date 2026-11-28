import { describe, expect, it } from 'vitest'

import { operationsSuffix } from './collectionCalls.mjs'

describe('operationsSuffix', () => {
  it('writes the operations in brackets, or says none is shown', () => {
    expect(operationsSuffix(['create', 'read'])).toBe(' (create, read)')
    expect(operationsSuffix([])).toBe(' (operation not shown)')
  })
})
