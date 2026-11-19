import React from 'react'

import { ThemeProvider } from './ThemeProvider.client'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return <ThemeProvider>{children}</ThemeProvider>
}
