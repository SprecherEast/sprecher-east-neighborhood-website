// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Tabs, type TabsItem } from './Tabs.client'

const scrolled = vi.fn()
const selected = () =>
  screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')
    ?.textContent

/** Two tabs, the second holding a heading a link (the "On this page" menu's) can name */
const ITEMS: TabsItem[] = [
  { value: 'one', trigger: 'Overview', heading: 'Overview', panel: <h3 id="first">First</h3> },
  { value: 'two', trigger: 'The plan', heading: 'The plan', panel: <h3 id="second">Second</h3> },
]
const setup = () => render(<Tabs label="Sections" items={ITEMS} defaultValue="one" />)

beforeEach(() => {
  window.history.replaceState(null, '', '/post')
  Element.prototype.scrollIntoView = scrolled
  scrolled.mockClear()
})
afterEach(cleanup)

describe('a link to something inside a tab’s content (#1333)', () => {
  it('opens the tab that holds it on load, and brings it into view', () => {
    window.history.replaceState(null, '', '/post#second')
    setup()
    expect(selected()).toBe('The plan')
    expect(scrolled).toHaveBeenCalledTimes(1)
    expect(scrolled.mock.contexts[0]).toBe(document.getElementById('second'))
  })

  it('opens it when the address changes on the page, as a menu link does', () => {
    setup()
    act(() => {
      window.history.replaceState(null, '', '/post#second')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(selected()).toBe('The plan')
    expect(scrolled.mock.contexts[0]).toBe(document.getElementById('second'))
  })

  it('does not change the tab for a link to something outside every tab', () => {
    render(
      <>
        <h2 id="outside">Outside</h2>
        <Tabs label="Sections" items={ITEMS} defaultValue="one" />
      </>,
    )
    act(() => {
      window.history.replaceState(null, '', '/post#outside')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(selected()).toBe('Overview')
    expect(scrolled).not.toHaveBeenCalled()
  })

  it('leaves a heading in the tab already open to the browser', () => {
    window.history.replaceState(null, '', '/post#first')
    setup()
    expect(selected()).toBe('Overview')
    expect(scrolled).not.toHaveBeenCalled()
  })
})
