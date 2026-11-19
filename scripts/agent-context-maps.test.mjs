import { describe, expect, it } from 'vitest'

import { describes } from './agent-context-maps.mjs'

describe('describes', () => {
  const entry = { paths: ['src/modules/events/**', 'docs/x.md'] }

  it.each([
    ['src/modules/events/domain/scope.ts', true],
    ['docs/x.md', true],
    ['src/modules/news/domain/scope.ts', false],
    // The sync check and the hook leave tests out
    ['src/modules/events/domain/scope.test.ts', false],
    ['src/modules/events/ui/Card.test.tsx', false],
  ])('%s is %s', (file, expected) => {
    expect(describes(entry, file)).toBe(expected)
  })
})
