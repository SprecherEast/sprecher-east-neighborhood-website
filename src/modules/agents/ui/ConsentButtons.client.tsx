'use client'

import { useActionState } from 'react'

import { Alert } from '@/platform/ui/Alert'
import { ButtonRow } from '@/platform/ui/ButtonRow'
import { Button } from '@/platform/ui'

import type { ConsentView } from '../use-cases/oauth/beginAuthorization'
import { decideConnectionForm } from '../actions'

/**
 * Approve or not. A form whose server action carries the request and its ticket, and each button
 * its choice, so a press before the page has hydrated still works. The browser then leaves for the
 * AI tool, so a refusal is the only answer shown here.
 */
export function ConsentButtons({ view }: { view: Pick<ConsentView, 'request' | 'ticket'> }) {
  const [refusal, decide, pending] = useActionState(
    decideConnectionForm.bind(null, { request: view.request, ticket: view.ticket }),
    null,
  )

  return (
    <form action={decide} className="space-y-4">
      {refusal && <Alert tone="error">{refusal.message}</Alert>}
      <ButtonRow>
        <Button type="submit" name="decision" value="approve" loading={pending} fullWidth="mobile">
          Allow this connection
        </Button>
        <Button
          type="submit"
          name="decision"
          value="deny"
          variant="secondary"
          disabled={pending}
          fullWidth="mobile"
        >
          Don’t allow
        </Button>
      </ButtonRow>
    </form>
  )
}
