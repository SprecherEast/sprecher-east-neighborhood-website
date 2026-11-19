'use client'

import { RotateCw } from 'lucide-react'
import React from 'react'

import { Button, EmptyState } from '@/platform/ui'

import './(frontend)/globals.css'

/**
 * What a visitor sees when the root layout itself fails, such as its header and footer reads
 * (#521): `error.tsx` can't wrap its own layout, so Next swaps in this page, which brings its own
 * `<html>` and `<body>`. Minimal on purpose: the site's theme, header and footer are what failed,
 * so it takes only the stylesheet and the UI kit. The error is not shown.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <head>
        {/* No metadata export here (Next 16): the page needs its own title (WCAG 2.4.2) */}
        <title>Something went wrong</title>
      </head>
      <body>
        <main>
          <EmptyState
            variant="page"
            className="container"
            title="500"
            description="Something went wrong on our side. Please try again."
            action={
              <Button onClick={retry} iconStart={<RotateCw aria-hidden="true" />}>
                Try again
              </Button>
            }
          />
        </main>
      </body>
    </html>
  )
}
