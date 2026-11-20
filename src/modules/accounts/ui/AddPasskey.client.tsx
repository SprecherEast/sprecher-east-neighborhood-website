'use client'

import { KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import { message } from '@/platform/lib'
import { Alert, Button, Field } from '@/platform/ui'
import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import { addPasskey, getPasskeyOptions, signOut } from '../actions'
import { PASSKEY_LABEL_MAX_LENGTH } from '../domain/passkeys'
import { SIGN_IN_PATH } from '../domain/paths'
import { createPasskey, passkeysSupported } from './passkeyBrowser'
import { toAddPasskeyNotice, type AddPasskeyOutcome, type PasskeyNotice } from './passkeyMessages'

const HEADING_ID = 'passkeys-heading'

/**
 * Asks for the options, shows the browser's own prompt, then sends its answer. Every way it can
 * end is one outcome; nothing the server or the browser says is passed on as text. A request that
 * gets no answer is `offline`.
 */
async function addAPasskey(label: string): Promise<AddPasskeyOutcome> {
  try {
    const started = await getPasskeyOptions()
    if (!started.ok) return started.failure
    const made = await createPasskey(started.options)
    if (!made.ok) return made.reason
    const finished = await addPasskey({ answer: made.answer, label })
    return finished.ok ? 'added' : finished.failure
  } catch {
    return 'offline'
  }
}

/**
 * The "Passkeys" card on /account (#1314, decision 0021): a name field and "Add a passkey". The
 * server decides whether the card is on (the page only renders this when it is); this also waits
 * for the browser to say it can make a passkey, and until then, and when it can't, shows nothing.
 * The account comes from the session, not a prop. An old sign-in is asked to log in again, which
 * ends this session and opens the log in page; signing in lands back on the account page.
 */
export function AddPasskey() {
  const router = useRouter()
  const [supported, setSupported] = useState(false)
  const [label, setLabel] = useState('')
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState<PasskeyNotice | null>(null)

  useEffect(() => {
    let current = true
    void passkeysSupported().then((yes) => {
      if (current) setSupported(yes)
    })
    return () => {
      current = false
    }
  }, [])

  if (!supported) return null

  const add = async () => {
    setWorking(true)
    setNotice(null)
    const outcome = await addAPasskey(label)
    if (outcome === 'added') setLabel('')
    setNotice(toAddPasskeyNotice(outcome))
    setWorking(false)
  }

  const logInAgain = async () => {
    try {
      await signOut()
    } catch {
      return setNotice(toAddPasskeyNotice('offline'))
    }
    router.push(SIGN_IN_PATH)
    router.refresh()
  }

  return (
    <Card as="section" variant="muted" aria-labelledby={HEADING_ID}>
      <Text variant="subsection" id={HEADING_ID} className="mb-4">
        Passkeys
      </Text>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          if (!working) void add()
        }}
      >
        <Text variant="small">{message('accounts.passkey.lead')}</Text>
        <Field label="Passkey name" hint="Optional. It helps you tell your passkeys apart.">
          <Field.Input
            autoComplete="off"
            maxLength={PASSKEY_LABEL_MAX_LENGTH}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </Field>
        <div>
          <Button
            type="submit"
            fullWidth="mobile"
            loading={working}
            iconStart={<KeyRound aria-hidden />}
          >
            Add a passkey
          </Button>
        </div>
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        {notice?.logInAgain && (
          <div>
            <Button variant="secondary" fullWidth="mobile" onClick={logInAgain}>
              Log in again
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}
