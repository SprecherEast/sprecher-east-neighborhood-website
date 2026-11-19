'use client'

import { RotateCw } from 'lucide-react'
import React from 'react'

import { Button, EmptyState } from '@/platform/ui'

/**
 * What a visitor sees when a page throws while it renders (#521): Next's error boundary for the
 * public site, in place of its blank default. `retry` asks Next to render the segment again. The
 * error itself is not shown: it can hold details of ours, and the server has logged it.
 */
export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
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
  )
}
