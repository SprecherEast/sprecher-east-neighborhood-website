'use client'

import { KeyRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { Alert, Button } from '@/platform/ui'

import { getPasskeyLoginOptions, logInWithPasskey } from '../actions'
import { ACCOUNT_PATH } from '../domain/paths'
import { getPasskey, passkeyAutofillSupported, passkeysSupported } from './passkeyBrowser'
import {
  PASSKEY_LOGIN_LABEL,
  toPasskeyLoginNotice,
  type PasskeyLoginOutcome,
} from './passkeyMessages'

type Notice = NonNullable<ReturnType<typeof toPasskeyLoginNotice>>

/**
 * Asks for the options, shows the browser's own prompt (or, with `autofill`, waits in the email
 * field's autofill list), then sends its answer. Every way it can end is one outcome; nothing the
 * server or the browser says is passed on as text. A request that gets no answer is `offline`. An
 * autofill request nobody asked for is quiet unless a passkey was picked and refused: its own
 * failures, and a refused request for options, end as `cancelled`.
 */
async function logInWithAPasskey(
  rememberMe: () => boolean,
  autofill: boolean,
): Promise<PasskeyLoginOutcome | 'signed-in'> {
  try {
    const started = await getPasskeyLoginOptions()
    if (!started.ok) return autofill ? 'cancelled' : started.failure
    const got = await getPasskey(started.options, { autofill })
    if (!got.ok) return autofill ? 'cancelled' : got.reason
    // Read now, not when the page opened: the box may have changed while the prompt was open
    const finished = await logInWithPasskey({ answer: got.answer, rememberMe: rememberMe() })
    return finished.ok ? 'signed-in' : finished.failure
  } catch {
    return 'offline'
  }
}

/**
 * "Log in with a passkey" on /login (#1315, decision 0021), under the email and password form,
 * whose "Keep me signed in" box it honors. The server decides whether it is on (the form only
 * renders this when it is); this also waits for the browser to say it can use a passkey, and until
 * then, and when it can't, shows nothing. Where the browser can offer a passkey in the email
 * field's autofill list, one request waits there from the start; pressing the button replaces it.
 * A closed prompt gets no message; any failure is one fixed message and the form stays as it was.
 * A good log in opens the account page.
 */
export function PasskeySignIn({ rememberMe }: { rememberMe: boolean }) {
  const router = useRouter()
  const [supported, setSupported] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const rememberRef = useRef(rememberMe)
  rememberRef.current = rememberMe
  const attempt = useRef(0)

  const run = async (autofill: boolean) => {
    const mine = ++attempt.current
    if (!autofill) {
      setBusy(true)
      setNotice(null)
    }
    const outcome = await logInWithAPasskey(() => rememberRef.current, autofill)
    // A newer attempt (the button, after the autofill one) has replaced this one
    if (mine !== attempt.current) return
    if (outcome === 'signed-in') {
      router.push(ACCOUNT_PATH)
      router.refresh()
      return
    }
    setBusy(false)
    setNotice(toPasskeyLoginNotice(outcome))
  }

  useEffect(() => {
    let current = true
    void (async () => {
      if (!(await passkeysSupported()) || !current) return
      setSupported(true)
      if (await passkeyAutofillSupported()) void run(true)
    })()
    return () => {
      current = false
    }
    // Once, when the form opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!supported) return null

  return (
    <div className="space-y-3">
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      <Button
        type="button"
        variant="secondary"
        fullWidth
        loading={busy}
        iconStart={<KeyRound aria-hidden />}
        onClick={() => void run(false)}
      >
        {PASSKEY_LOGIN_LABEL}
      </Button>
    </div>
  )
}
