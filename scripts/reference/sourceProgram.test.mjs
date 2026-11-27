import { describe, expect, it } from 'vitest'

import { componentSourceFiles } from './sourceProgram.mjs'

describe('componentSourceFiles', () => {
  it('keeps the UI kit and rich text components, sorted, without tests, stories, examples and test helpers', () => {
    const files = [
      '/r/src/platform/ui/Card.tsx',
      '/r/src/platform/ui/Button.tsx',
      '/r/src/platform/ui/Button.test.tsx',
      '/r/src/platform/ui/Button.stories.tsx',
      '/r/src/platform/ui/Button.examples.tsx',
      '/r/src/platform/ui/Card.contract.tsx',
      '/r/src/platform/ui/testing/Harness.tsx',
      '/r/src/platform/richtext/RichText.tsx',
      '/r/src/modules/events/ui/EventCard.tsx',
      '/r/src/platform/ui/helper.ts',
    ]
    expect(componentSourceFiles(files)).toEqual([
      '/r/src/platform/richtext/RichText.tsx',
      '/r/src/platform/ui/Button.tsx',
      '/r/src/platform/ui/Card.tsx',
    ])
  })
})
