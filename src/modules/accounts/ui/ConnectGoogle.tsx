import { LogIn } from 'lucide-react'
import React from 'react'

import { message } from '@/platform/lib'
import { Alert } from '@/platform/ui/Alert'
import { Button } from '@/platform/ui/Button'
import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import { socialLinkPath } from '../domain/googleLink'
import { parseLinkResult } from './googleLinkMessages'

const HEADING_ID = 'google-heading'

type Props = {
  /** `connected` when the account already has a Google identity, otherwise the button shows */
  connection: 'available' | 'connected'
  /** The `?social=` value a connect came back with */
  result?: unknown
}

/**
 * The "Google" card on /account (#1338, decision 0020): the button that connects Google to the
 * signed-in account, or, once it is, the line that says so. The page renders it only while Google
 * is on. The button is a plain GET form, so the browser itself leaves the site for Google: a link
 * would be prefetched. The account comes from the session on the server, never from the page.
 * `fullWidth="mobile"` gives the one full-width 44 px button on a phone.
 */
export function ConnectGoogle({ connection, result }: Props) {
  const notice = parseLinkResult(result)
  return (
    <Card as="section" variant="muted" aria-labelledby={HEADING_ID}>
      <Text variant="subsection" id={HEADING_ID} className="mb-4">
        Google
      </Text>
      <div className="space-y-4">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        {connection === 'connected' ? (
          !notice && <Alert tone="success">{message('accounts.google.connected')}</Alert>
        ) : (
          <>
            <Text variant="small">{message('accounts.google.connectLead')}</Text>
            <form action={socialLinkPath('google')} method="get">
              <Button
                type="submit"
                variant="secondary"
                fullWidth="mobile"
                iconStart={<LogIn aria-hidden />}
              >
                Connect Google
              </Button>
            </form>
          </>
        )}
      </div>
    </Card>
  )
}
