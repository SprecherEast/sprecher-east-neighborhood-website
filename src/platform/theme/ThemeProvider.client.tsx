'use client'

import React, { createContext, useCallback, useEffect, useState, use } from 'react'

import type { Theme, ThemeContextType } from './theme'
import { defaultTheme, getImplicitPreference, themeIsValid, themeLocalStorageKey } from './theme'

const initialContext: ThemeContextType = {
  setTheme: () => null,
  theme: undefined,
}

const ThemeContext = createContext(initialContext)

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme | undefined>(undefined)

  const setTheme = useCallback((themeToSet: Theme | null) => {
    if (themeToSet === null) {
      // "Auto" — remove override, use system preference
      window.localStorage.removeItem(themeLocalStorageKey)
      const implicitPreference = getImplicitPreference()
      const resolved = implicitPreference || defaultTheme
      document.documentElement.setAttribute('data-theme', resolved)
      setThemeState(resolved)
    } else {
      window.localStorage.setItem(themeLocalStorageKey, themeToSet)
      document.documentElement.setAttribute('data-theme', themeToSet)
      setThemeState(themeToSet)
    }
  }, [])

  useEffect(() => {
    // On mount, read the visitor's theme, and set it on <html> too. InitTheme's script has
    // usually set it already; it hasn't on a 404 (a page calling notFound()), which Next serves
    // as an error page without the layout's <head> and renders in the browser (#413)
    const stored = window.localStorage.getItem(themeLocalStorageKey)
    const resolved = themeIsValid(stored) ? stored : getImplicitPreference() || defaultTheme
    document.documentElement.setAttribute('data-theme', resolved)
    setThemeState(resolved)
  }, [])

  // Listen for system preference changes when no user override is set
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const stored = window.localStorage.getItem(themeLocalStorageKey)
      if (!stored) {
        // No user override — follow system
        const newTheme = mediaQuery.matches ? 'dark' : 'light'
        document.documentElement.setAttribute('data-theme', newTheme)
        setThemeState(newTheme)
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return <ThemeContext value={{ setTheme, theme }}>{children}</ThemeContext>
}

export const useTheme = (): ThemeContextType => use(ThemeContext)
