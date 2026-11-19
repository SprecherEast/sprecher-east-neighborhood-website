import React from 'react'
import { Home } from 'lucide-react'

import { Button, EmptyState } from '@/platform/ui'

export default function NotFound() {
  return (
    <EmptyState
      variant="page"
      className="container"
      title="404"
      description="This page could not be found."
      action={
        <Button href="/" iconStart={<Home aria-hidden="true" />}>
          Go home
        </Button>
      }
    />
  )
}
