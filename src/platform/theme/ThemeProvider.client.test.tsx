// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from './ThemeProvider.client'
import { themeLocalStorageKey } from './theme'

const prefersDark = (dark: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('dark'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ThemeProvider', () => {
  // A 404 for an unknown address comes without the script that sets the theme (#413)
  it("sets the visitor's chosen theme on <html> when nothing has set it", () => {
    prefersDark(false)
    window.localStorage.setItem(themeLocalStorageKey, 'dark')
    render(<ThemeProvider>page</ThemeProvider>)

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it("follows the device's dark mode when the visitor hasn't chosen", () => {
    prefersDark(true)
    render(<ThemeProvider>page</ThemeProvider>)

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
