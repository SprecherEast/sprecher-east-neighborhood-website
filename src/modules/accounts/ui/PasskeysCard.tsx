import React from 'react'

import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import type { PasskeyListItem } from '../domain/removePasskey'
import { AddPasskey } from './AddPasskeyLoader.client'
import { PasskeyList } from './PasskeyList.client'

const HEADING_ID = 'passkeys-heading'

/**
 * The "Passkeys" card on /account (#1314, #1316, decision 0021): the account's passkeys with a way
 * to remove each, then the form that adds one. The page renders it only while the passkey switch
 * is on, and passes the list from the session's account. The add form waits for a browser that
 * can make a passkey; the list shows either way, so a passkey can still be removed.
 */
export function PasskeysCard({ passkeys }: { passkeys: PasskeyListItem[] }) {
  return (
    <Card as="section" variant="muted" aria-labelledby={HEADING_ID}>
      <Text variant="subsection" id={HEADING_ID} className="mb-4">
        Passkeys
      </Text>
      <PasskeyList passkeys={passkeys} />
      <AddPasskey />
    </Card>
  )
}
