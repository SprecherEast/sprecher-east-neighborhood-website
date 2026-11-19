// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { ForumPrompt } from './ForumPrompt'

afterEach(cleanup)

describe('ForumPrompt', () => {
  it('links to the forum in a new tab, and says so', async () => {
    const { container } = render(
      <main>
        <ForumPrompt href="https://discourse.sprechereast.org" />
      </main>,
    )

    const link = screen.getByRole('link', {
      name: 'Talk it over on the neighborhood forum, opens in a new tab',
    })
    expect(link.getAttribute('href')).toBe('https://discourse.sprechereast.org')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.getByRole('complementary', { name: 'Discuss on the forum' })).toBeTruthy()
    await expectAccessible(container)
  })

  it('draws nothing without a forum address', () => {
    const { container } = render(<ForumPrompt href={null} />)

    expect(container.innerHTML).toBe('')
  })
})
