// @vitest-environment jsdom
// What a reader sees follows the brand voice (docs/guidelines/brand-voice.md): we, never I or me; AI tools,
// never a model's name; the name in full.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import NotFound from './not-found'
import Home from './page'
import Showcase from './showcase/page'

afterEach(cleanup)

describe.each([
  ['the home page', Home],
  ['the showcase page', Showcase],
  ['the 404 page', NotFound],
])('%s', (_name, Page) => {
  it('speaks as we, names no model, and never abbreviates the name', () => {
    const { container } = render(<Page />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\b(I|me|my)\b/)
    expect(text).not.toMatch(/Claude|Gemini|Grok|GPT|SENA/)
  })
})
