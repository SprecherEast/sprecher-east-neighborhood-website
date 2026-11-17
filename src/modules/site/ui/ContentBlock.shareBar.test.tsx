// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { ContentBlock } from './ContentBlock'
import { doc, heading, paragraph, text } from './testing/richText'

afterEach(cleanup)

describe('ContentBlock share bar', () => {
  it('draws the share bar right under the opening heading, before the text and the button (#1266)', async () => {
    const { container } = render(
      <main>
        <ContentBlock
          layout="single"
          columns={[
            {
              size: 'full',
              body: doc(
                heading('h2', "It's tax time"),
                paragraph(text('Where does your share go?')),
              ),
              shareBar: { schools: 50, city: 30, county: 15, matc: 5 },
              link: { href: '/tax', label: 'Estimate', external: false, appearance: 'default' },
              linkAlign: 'beside',
            },
          ]}
        />
      </main>,
    )

    const bar = screen.getByRole('img', {
      name: /Metropolitan Schools 50%, City of Madison 30%, Dane County 15%, Madison College, MATC 5%/,
    })
    const title = screen.getByRole('heading', { name: "It's tax time" })
    const body = screen.getByText('Where does your share go?')
    expect(title.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(bar.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expectAccessible(container)
  })

  it('draws no bar for a column without one', () => {
    render(
      <main>
        <ContentBlock
          layout="single"
          columns={[{ size: 'full', body: doc(heading('h2', 'Our area')) }]}
        />
      </main>,
    )
    expect(screen.queryByRole('img')).toBeNull()
  })
})
