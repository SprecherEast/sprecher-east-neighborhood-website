'use client'

import { useActionState } from 'react'

import { Alert } from '@/platform/ui/Alert'
import { ButtonRow } from '@/platform/ui/ButtonRow'
import { Button } from '@/platform/ui'

import type { DecideAction } from '../actions'

/**
 * Approve or not. A form whose server action carries the request and its ticket, and each button
 * its choice, so a press before the page has hydrated still works. The browser then leaves for the
 * AI tool, so a refusal is the only answer shown here. The action arrives already bound, from the
 * server component: binding it here, on every render, makes a new pending promise each time on the
 * server, and the render of a refusal before hydration then never finishes.
 */
export function ConsentButtons({ action }: { action: DecideAction }) {
  const [refusal, decide, pending] = useActionState(action, null)

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
