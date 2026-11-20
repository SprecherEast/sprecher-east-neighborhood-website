import React from 'react'

/**
 * A short line of words between two groups, with a rule on each side, such as "Or use your email
 * and password" between the quick ways to log in and the form (#1365). The rules are decoration:
 * screen readers read only the words.
 */
export function TextDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span>{children}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  )
}
