'use client'

import { KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import { message } from '@/platform/lib'
import { Alert, Button, Field, Form, type FormStatus } from '@/platform/ui'
import { Text } from '@/platform/ui/Text'

import { addPasskey, getPasskeyOptions } from '../actions'
import { passkeyLabelSchema } from '../domain/addPasskey'
import { PASSKEY_LABEL_MAX_LENGTH } from '../domain/passkeys'
import { LogInAgainButton } from './LogInAgainButton.client'
import { createPasskey, passkeysSupported } from './passkeyBrowser'
import { toAddPasskeyNotice, type AddPasskeyOutcome, type PasskeyNotice } from './passkeyMessages'

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
 * The add-a-passkey part of the "Passkeys" card on /account (#1314, decision 0021), under the
 * list (`PasskeysCard`), on the kit's `Form`: an optional name and "Add a passkey". The server
 * decides whether the card is on (the page only renders it when it is); this also waits for the browser to say it can make a passkey, and until then, and when it
 * can't, shows nothing. The account comes from the session, not a prop. Success and errors are the
 * form's own messages; a closed prompt, a device that already has one, the cap and an old sign-in
 * are notices that aren't errors. An old sign-in is asked to log in again, which ends this session
 * and opens the log in page; signing in lands back on the account page.
 */
export function AddPasskey() {
  const router = useRouter()
  const [supported, setSupported] = useState(false)
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
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

  const show = (outcome: AddPasskeyOutcome) => {
    const result = toAddPasskeyNotice(outcome)
    setNotice(result.tone === 'info' || result.tone === 'warning' ? result : null)
    setErrorMessage(result.tone === 'error' ? result.text : '')
    setStatus(result.tone === 'success' ? 'success' : result.tone === 'error' ? 'error' : 'idle')
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <Form
        aria-label="Add a passkey"
        schema={passkeyLabelSchema}
        onSubmit={async ({ label }, form) => {
          setStatus('submitting')
          setNotice(null)
          const outcome = await addAPasskey(label)
          if (outcome === 'added') {
            form.reset()
            // The list above is the server page's: it shows the new passkey after a refresh
            router.refresh()
          }
          show(outcome)
        }}
        status={status}
        successMessage={toAddPasskeyNotice('added').text}
        errorMessage={errorMessage}
      >
        {({ register, formState: { errors } }) => (
          <>
            <Text variant="small">{message('accounts.passkey.lead')}</Text>
            <Field
              label="Passkey name"
              hint="Optional. It helps you tell your passkeys apart."
              error={errors.label?.message}
            >
              <Field.Input
                autoComplete="off"
                maxLength={PASSKEY_LABEL_MAX_LENGTH}
                {...register('label', { onChange: () => setNotice(null) })}
              />
            </Field>
            {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
            {notice?.logInAgain && <LogInAgainButton onFailed={() => show('offline')} />}
            <div>
              <Button
                type="submit"
                fullWidth="mobile"
                loading={status === 'submitting'}
                iconStart={<KeyRound aria-hidden />}
              >
                Add a passkey
              </Button>
            </div>
          </>
        )}
      </Form>
    </div>
  )
}
