import React from 'react'

import { message } from '@/platform/lib'
import { Alert } from '@/platform/ui/Alert'
import { Button } from '@/platform/ui/Button'

import { SIGN_IN_PATH } from '../domain/paths'

/**
 * What the password step says once it can't go on (#1338): one fixed message and the way back to
 * log in. The same view for every reason (a wrong password, a link that ran out, a browser that
 * never asked for one), so it never says which. A try uses up what Google said, and the server
 * then draws the page again without it, so the page and the form both show this.
 */
export function ConnectGoogleClosed() {
  return (
    <div className="space-y-4">
      <Alert tone="error">{message('accounts.google.passwordFailed')}</Alert>
      <Button href={SIGN_IN_PATH} fullWidth="mobile">
        Back to Log In
      </Button>
    </div>
  )
}
