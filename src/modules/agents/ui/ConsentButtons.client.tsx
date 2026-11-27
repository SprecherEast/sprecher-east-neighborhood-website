'use client'

import { useState, useTransition } from 'react'

import { Alert } from '@/platform/ui/Alert'
import { Button } from '@/platform/ui'

import type { ConsentView } from '../use-cases/oauth/beginAuthorization'
import { decideConnection } from '../actions'

/**
 * Approve or not. Each button is a server action carrying the request and its ticket; the browser
 * then leaves for the AI tool, so a refusal is the only answer shown here.
 */
export function ConsentButtons({ view }: { view: Pick<ConsentView, 'request' | 'ticket'> }) {
  const [pending, start] = useTransition()
  const [refusal, setRefusal] = useState<string | null>(null)

  const decide = (decision: 'approve' | 'deny') =>
    start(async () => {
      const answer = await decideConnection({
        request: view.request,
        ticket: view.ticket,
        decision,
      })
      setRefusal(answer.message)
    })

  return (
    <div className="space-y-4">
      {refusal && <Alert tone="error">{refusal}</Alert>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          loading={pending}
          fullWidth="mobile"
          onClick={() => decide('approve')}
        >
          Allow this connection
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          fullWidth="mobile"
          onClick={() => decide('deny')}
        >
          Don’t allow
        </Button>
      </div>
    </div>
  )
}
