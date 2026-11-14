// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Disclosure } from './Disclosure'

afterEach(cleanup)

describe('Disclosure, the anchor kept in view when it opens (#1178)', () => {
  it('names the element to keep in view when it opens, only for the boxes that scroll (#1178)', () => {
    const { container } = render(
      <>
        <Disclosure variant="listRow" summary="A" revealAnchor="card-title">
          Body
        </Disclosure>
        <Disclosure variant="bar" summary="B" revealAnchor="card-title">
          Body
        </Disclosure>
        <Disclosure variant="card" summary="C">
          Body
        </Disclosure>
      </>,
    )
    const [list, bar, card] = [...container.querySelectorAll('details')]
    expect(list?.getAttribute('data-reveal-anchor')).toBe('card-title')
    expect(bar?.hasAttribute('data-reveal-anchor')).toBe(false)
    expect(card?.hasAttribute('data-reveal-anchor')).toBe(false)
  })
})
