// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import Page from './page'

afterEach(cleanup)

describe('the developer home page', () => {
  it('has one h1 for the people building the site', () => {
    render(<Page />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('links to the component showcase', () => {
    render(<Page />)
    // Next's Link adds the slash from the build's `trailingSlash` setting (developer/next.config.mjs)
    const href = screen.getByRole('link', { name: /component showcase/i }).getAttribute('href')
    expect(href).toMatch(/^\/showcase\/?$/)
  })

  it('says it is unofficial and made with AI tools, never naming a model', () => {
    const { container } = render(<Page />)
    expect(container.textContent).toMatch(/unofficial/i)
    expect(container.textContent).toMatch(/AI tools/)
    expect(container.textContent).not.toMatch(/claude|gemini|grok|gpt/i)
  })
})
