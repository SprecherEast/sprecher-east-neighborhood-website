// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import GlobalError from './global-error'

afterEach(cleanup)

describe('the global error page', () => {
  it('says what happened, without the error’s text, and passes axe as a whole document', async () => {
    // It renders its own <html>, so mount it as the document's root, as Next does
    const { container } = render(
      <GlobalError error={new Error('Failed query: params ada@example.com')} retry={() => {}} />,
      { container: document, baseElement: document },
    )

    expect(document.title).toBe('Something went wrong')
    expect(document.querySelector('main')?.textContent).toContain(
      'Something went wrong on our side',
    )
    expect(document.documentElement.outerHTML).not.toContain('ada@example.com')
    await expectAccessible(container as unknown as Element)
  })
})
