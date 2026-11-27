import { describe, expect, it } from 'vitest'

import {
  componentSourceFiles,
  examplesSourceFiles,
  isComponentSourceFile,
} from './sourceProgram.mjs'

describe('componentSourceFiles', () => {
  it('keeps the UI kit and rich text components, sorted, without tests, stories, examples and test helpers', () => {
    const files = [
      '/r/src/platform/ui/Card.tsx',
      '/r/src/platform/ui/Button.tsx',
      '/r/src/platform/ui/Button.test.tsx',
      '/r/src/platform/ui/Button.stories.tsx',
      '/r/src/platform/ui/Button.examples.tsx',
      '/r/src/platform/ui/Button.examples.client.tsx',
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

describe('isComponentSourceFile', () => {
  it('takes a path under the repository as well as an absolute one', () => {
    expect(isComponentSourceFile('src/platform/ui/Button.tsx')).toBe(true)
    expect(isComponentSourceFile('/r/src/platform/richtext/RichText.tsx')).toBe(true)
    expect(isComponentSourceFile('src/platform/ui/Button.examples.client.tsx')).toBe(false)
    expect(isComponentSourceFile('src/platform/ui/testing/Harness.tsx')).toBe(false)
    expect(isComponentSourceFile('src/modules/news/ui/Card.tsx')).toBe(false)
  })
})

describe('examplesSourceFiles', () => {
  it('lists the server and client examples files of the kit and rich text under the root, sorted', () => {
    const files = [
      '/r/src/platform/ui/Tabs.examples.client.tsx',
      '/r/src/platform/ui/Button.examples.tsx',
      '/r/src/platform/richtext/RichText.examples.tsx',
      '/r/src/platform/ui/Button.tsx',
      '/r/src/modules/news/ui/Card.examples.tsx',
    ]
    expect(examplesSourceFiles(files, '/r')).toEqual([
      'src/platform/richtext/RichText.examples.tsx',
      'src/platform/ui/Button.examples.tsx',
      'src/platform/ui/Tabs.examples.client.tsx',
    ])
  })
})
