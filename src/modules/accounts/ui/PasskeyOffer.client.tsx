'use client'

import { KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { message } from '@/platform/lib'
import { Alert, Button } from '@/platform/ui'
import { ButtonRow } from '@/platform/ui/ButtonRow'
import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import { isPasskeyOfferSnoozed, passkeyOfferSnoozeUntil } from '../domain/passkeyOffer'
import { addAPasskey } from './addAPasskey'
import { LogInAgainButton } from './LogInAgainButton.client'
import { passkeysSupported } from './passkeyBrowser'
import { toAddPasskeyNotice, type PasskeyNotice } from './passkeyMessages'

/** Where this browser keeps "Not now": the time it ends (`domain/passkeyOffer.ts`). */
export const PASSKEY_OFFER_STORAGE_KEY = 'passkey-offer-snoozed-until'

const HEADING_ID = 'passkey-offer-title'

// Storage can be blocked or full (private modes, policies): then the answer holds for this visit only
const readSnooze = () => {
  try {
    return localStorage.getItem(PASSKEY_OFFER_STORAGE_KEY)
  } catch {
    return null
  }
}
const writeSnooze = (until: string) => {
  try {
    localStorage.setItem(PASSKEY_OFFER_STORAGE_KEY, until)
  } catch {
    // Nothing to do: the offer is hidden for this visit either way
  }
}

/**
 * The offer to add a passkey, at the top of /account, where a log in with email and password or
 * with Google ends (#1364, FIDO's guidance is to offer at account moments). It is for a neighbor
 * with no passkey: `eligible` comes from the server page, which knows. This also waits for the
 * browser to say it can make one, and asks nothing and shows nothing until then, or when it can't,
 * or while a "Not now" holds (a month, kept in this browser only, `domain/passkeyOffer.ts`).
 *
 * "Set up a passkey" runs the same add step as the card below it, with no name, so the
 * browser's own prompt is where the screen lock or a phone's QR code are offered; the session's
 * recent sign-in rule and every limit are the server's, unchanged. Once added it keeps its
 * confirmation even though the page then stops being eligible. It never touches the log in form.
 */
export function PasskeyOffer({ eligible }: { eligible: boolean }) {
  const router = useRouter()
  // `null` until the browser has answered
  const [supported, setSupported] = useState<boolean | null>(null)
  const [snoozed, setSnoozed] = useState(true)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [notice, setNotice] = useState<PasskeyNotice | null>(null)
  const answerRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    let current = true
    void passkeysSupported().then((yes) => {
      if (!current) return
      setSnoozed(isPasskeyOfferSnoozed(readSnooze(), Date.now()))
      setSupported(yes)
    })
    return () => {
      current = false
    }
  }, [])

  useEffect(() => {
    // The "Not now" button is gone: put keyboard and screen reader users on the answer
    if (declined) answerRef.current?.focus()
  }, [declined])

  if (added) {
    return (
      <Alert tone="success">
        <span className="font-semibold">{toAddPasskeyNotice('added').text}</span>
      </Alert>
    )
  }
  if (declined) {
    return (
      <p ref={answerRef} tabIndex={-1} className="text-muted-foreground outline-none">
        {message('accounts.passkeyOffer.snoozed')}
      </p>
    )
  }
  if (!eligible || !supported || snoozed) return null

  const add = async () => {
    if (busy) return
    setBusy(true)
    setNotice(null)
    const outcome = await addAPasskey('')
    setBusy(false)
    if (outcome === 'added') {
      setAdded(true)
      // The card below lists it after a refresh
      router.refresh()
      return
    }
    setNotice(toAddPasskeyNotice(outcome))
  }

  const notNow = () => {
    writeSnooze(passkeyOfferSnoozeUntil(Date.now()))
    setDeclined(true)
  }

  return (
    <Card as="section" variant="outline" aria-labelledby={HEADING_ID} className="space-y-4">
      <Text variant="subsection" id={HEADING_ID}>
        {message('accounts.passkeyOffer.title')}
      </Text>
      <Text variant="small">{message('accounts.passkeyOffer.lead')}</Text>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {notice?.logInAgain && (
        <LogInAgainButton onFailed={() => setNotice(toAddPasskeyNotice('offline'))} />
      )}
      <ButtonRow>
        <Button
          type="button"
          loading={busy}
          iconStart={<KeyRound aria-hidden />}
          onClick={() => void add()}
          fullWidth="mobile"
        >
          {message('accounts.passkeyOffer.add')}
        </Button>
        <Button type="button" variant="secondary" onClick={notNow} fullWidth="mobile">
          {message('accounts.passkeyOffer.notNow')}
        </Button>
      </ButtonRow>
    </Card>
  )
}
