// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/platform/theme/ThemeProvider.client'
import { ACTIVE_THEME } from '@/platform/theme/registry'

import { SiteTheme } from './ThemeDecorator'

const wrap = (name: string, mode: 'light' | 'dark', themes: Record<string, string>) => (
  <ThemeProvider>
    <SiteTheme name={name} mode={mode} themes={themes}>
      story
    </SiteTheme>
  </ThemeProvider>
)
const overlays = () => document.head.querySelectorAll('style[data-showcase-theme]')

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  document.documentElement.removeAttribute('data-theme')
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SiteTheme', () => {
  it('sets light or dark on <html> through the site theme, and follows the toolbar', () => {
    const { rerender } = render(wrap(ACTIVE_THEME, 'dark', {}))
    expect(document.documentElement.dataset.theme).toBe('dark')

    rerender(wrap(ACTIVE_THEME, 'light', {}))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('lays a theme that is not active over the page, and takes it off again', () => {
    const { rerender, unmount } = render(wrap('other', 'light', { other: ':root{--primary:red}' }))
    expect(overlays()).toHaveLength(1)
    expect(overlays()[0].textContent).toBe(':root{--primary:red}')

    rerender(wrap(ACTIVE_THEME, 'light', { other: ':root{--primary:red}' }))
    expect(overlays()).toHaveLength(0)

    rerender(wrap('other', 'light', { other: ':root{--primary:red}' }))
    unmount()
    expect(overlays()).toHaveLength(0)
  })

  it('lays nothing over the page for the active theme, whose tokens the site CSS already has', () => {
    render(wrap(ACTIVE_THEME, 'light', { [ACTIVE_THEME]: ':root{}' }))
    expect(overlays()).toHaveLength(0)
  })
})
