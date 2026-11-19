// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { ArchiveBlock } from './ArchiveBlock'
import { doc, heading, paragraph, text } from './testing/richText'

afterEach(cleanup)

describe('ArchiveBlock', () => {
  it('draws the intro, then the posts it is given, on a surface band with an anchor', async () => {
    const { container } = render(
      <main>
        <ArchiveBlock id="a1" intro={doc(heading('h2', 'Recent news'), paragraph(text('Updates')))}>
          <ul>
            <li>Park cleanup</li>
          </ul>
        </ArchiveBlock>
      </main>,
    )

    const band = container.querySelector('#block-a1')
    expect(band?.className).toContain('bg-surface')
    expect(screen.getByRole('heading', { name: 'Recent news' })).toBeTruthy()
    expect(screen.getByRole('listitem').textContent).toBe('Park cleanup')
    await expectAccessible(container)
  })

  it('draws just the posts without an intro or an anchor', () => {
    const { container } = render(
      <ArchiveBlock>
        <p>Posts</p>
      </ArchiveBlock>,
    )

    expect(container.querySelector('[id]')).toBeNull()
    expect(screen.queryByRole('heading')).toBeNull()
  })
})
