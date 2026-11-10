// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isOutboundLink, LIKELY_HUMAN_EVENT, startLikelyHumanClicks } from './likelyHumanClicks'

const track = vi.fn()
let stop: () => void

type UmamiWindow = Window & { umami?: { track: typeof track } }
const win = window as UmamiWindow

function setNavigator(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(window.navigator, key, { value, configurable: true })
  }
}

function page(html: string) {
  document.body.innerHTML = html
  return (selector: string) => {
    const element = document.querySelector<HTMLElement>(selector)
    if (!element) throw new Error(`No ${selector} on the test page`)
    return element
  }
}

/** The tests' stand-in for the browser's trusted flag, which jsdom never sets */
const asPerson = () => true

/** A person's click, as far as the listener started with `asPerson` can tell */
function personClicks(element: HTMLElement) {
  // A link would navigate; the listener only reads it
  const keepPage = (event: Event) => event.preventDefault()
  document.addEventListener('click', keepPage)
  element.click()
  document.removeEventListener('click', keepPage)
}

describe('startLikelyHumanClicks (#975)', () => {
  beforeEach(() => {
    track.mockReset()
    win.umami = { track }
    setNavigator({
      doNotTrack: null,
      msDoNotTrack: null,
      webdriver: false,
      userAgent: 'Mozilla/5.0 Chrome/120.0',
    })
    stop = startLikelyHumanClicks(document, window, asPerson)
  })
  afterEach(() => {
    stop()
    delete win.umami
    document.body.innerHTML = ''
  })

  it('records one event for a person’s click on a button, labeled by its text', () => {
    const $ = page('<button>Join the list</button>')
    personClicks($('button'))
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith(LIKELY_HUMAN_EVENT, {
      kind: 'button',
      target: 'Join the list',
    })
  })

  it('records a click on something inside a button', () => {
    const $ = page('<button aria-label="Open menu"><span id="icon"></span></button>')
    personClicks($('#icon'))
    expect(track).toHaveBeenCalledWith(LIKELY_HUMAN_EVENT, { kind: 'button', target: 'Open menu' })
  })

  it('records a link that leaves the site, naming only the other site’s host', () => {
    const $ = page('<a href="https://example.org/path?token=secret">Elsewhere</a>')
    personClicks($('a'))
    expect(track).toHaveBeenCalledWith(LIKELY_HUMAN_EVENT, {
      kind: 'outbound-link',
      target: 'example.org',
    })
  })

  it.each([
    '/events',
    `${window.location.origin}/events`,
    '#top',
    'mailto:hello@example.org',
    'tel:+16085550100',
    'javascript:void(0)',
  ])('ignores the in-site or non-web link %s', (href) => {
    const $ = page(`<a href="${href}">Go</a>`)
    personClicks($('a'))
    expect(track).not.toHaveBeenCalled()
  })

  it('ignores clicks that are not on a button or link', () => {
    const $ = page('<p id="text">Hello</p>')
    personClicks($('#text'))
    expect(track).not.toHaveBeenCalled()
  })

  it('ignores a disabled button', () => {
    const $ = page('<button disabled>Nope</button>')
    personClicks($('button'))
    expect(track).not.toHaveBeenCalled()
  })

  it('ignores clicks the browser does not call a person’s, such as a script’s', () => {
    stop()
    // The default rule: the browser's own flag, which a script-made click never has
    stop = startLikelyHumanClicks(document, window)
    const $ = page('<button>Join</button>')
    $('button').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    $('button').click()
    expect(track).not.toHaveBeenCalled()
  })

  it('counts each button once per visit, and a different button separately', () => {
    const $ = page('<button id="a">Join</button><button id="b">Share</button>')
    personClicks($('#a'))
    personClicks($('#a'))
    personClicks($('#b'))
    expect(track).toHaveBeenCalledTimes(2)
  })

  it('counts each outbound link once per visit', () => {
    const $ = page('<a href="https://example.org/a">A</a>')
    personClicks($('a'))
    personClicks($('a'))
    expect(track).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['webdriver', { webdriver: true }],
    ['a headless user agent', { userAgent: 'Mozilla/5.0 HeadlessChrome/120.0' }],
  ])('records nothing from a headless browser (%s)', (_name, navigatorValues) => {
    setNavigator(navigatorValues)
    const $ = page('<button>Join</button>')
    personClicks($('button'))
    expect(track).not.toHaveBeenCalled()
  })

  it.each([
    ['1', { doNotTrack: '1' }],
    ['yes', { doNotTrack: 'yes' }],
    ['the old Microsoft setting', { msDoNotTrack: '1' }],
  ])('sends nothing when Do Not Track is on (%s)', (_name, navigatorValues) => {
    setNavigator(navigatorValues)
    const $ = page('<button>Join</button>')
    personClicks($('button'))
    expect(track).not.toHaveBeenCalled()
  })

  it('does nothing, and does not fail, when the counter is not loaded', () => {
    delete win.umami
    const $ = page('<button>Join</button>')
    expect(() => personClicks($('button'))).not.toThrow()
  })

  it('keeps a long label short', () => {
    const $ = page(`<button>${'x'.repeat(200)}</button>`)
    personClicks($('button'))
    const { target } = track.mock.calls[0][1] as { target: string }
    expect(target.length).toBeLessThanOrEqual(60)
  })

  it('stores nothing: no cookie, no storage', () => {
    const $ = page('<button>Join</button>')
    personClicks($('button'))
    expect(document.cookie).toBe('')
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('stops listening when stopped', () => {
    stop()
    const $ = page('<button>Join</button>')
    personClicks($('button'))
    expect(track).not.toHaveBeenCalled()
  })
})

describe('isOutboundLink (#975)', () => {
  it('is true for another web host and false for this one, with or without www', () => {
    expect(isOutboundLink(new URL('https://example.org/'), 'sprechereast.com')).toBe(true)
    expect(isOutboundLink(new URL('https://sprechereast.com/a'), 'sprechereast.com')).toBe(false)
    expect(isOutboundLink(new URL('https://www.sprechereast.com/a'), 'sprechereast.com')).toBe(
      false,
    )
    expect(isOutboundLink(new URL('https://sprechereast.com/a'), 'www.sprechereast.com')).toBe(
      false,
    )
  })

  it('is false for addresses that are not web pages', () => {
    expect(isOutboundLink(new URL('mailto:a@example.org'), 'sprechereast.com')).toBe(false)
  })
})
