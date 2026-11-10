// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LikelyHumanClicks } from './LikelyHumanClicks.client'

describe('LikelyHumanClicks (#975)', () => {
  it('draws nothing, and listens for clicks on the whole page only while it is shown', () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')

    const { container, unmount } = render(<LikelyHumanClicks />)
    expect(container.innerHTML).toBe('')
    const added = add.mock.calls.filter(([type]) => type === 'click')
    expect(added).toHaveLength(1)

    unmount()
    const removed = remove.mock.calls.filter(([type]) => type === 'click')
    expect(removed).toHaveLength(1)
    expect(removed[0][1]).toBe(added[0][1])
  })
})
