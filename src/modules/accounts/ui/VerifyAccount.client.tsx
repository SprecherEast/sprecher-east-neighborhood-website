'use client'

import { MailCheck } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { Alert } from '@/platform/ui/Alert'
import { Button, Form } from '@/platform/ui'
import { TurnstileWidget } from '@/platform/turnstile/TurnstileWidget.client'
import { useRobotCheck } from '@/platform/turnstile/useRobotCheck.client'

import { verifyAccount } from '../actions'
import { newPasswordSchema, type NewPasswordValues } from '../domain/credentials'
import { SIGN_IN_PATH } from '../domain/paths'
import type { VerificationLinkStatus, VerifyAccountFailure } from '../domain/types'
import { NewPasswordFields } from './NewPasswordFields.client'
import {
  ACCOUNT_ALREADY_VERIFIED,
  ACCOUNT_VERIFIED,
  CHOOSE_PASSWORD_TO_VERIFY,
  toVerifyAccountErrorMessage,
} from './signUpMessages'

type Answer = 'verified' | VerifyAccountFailure | 'offline'

/**
 * The verify page's action (#187): one button that opens Payload's verification for the link's
 * token. Nothing happens on page load, because mail scanners open links too and would use it up,
 * and some run the page's script (#303). The button also needs the robot check (Turnstile,
 * decision 0003) to pass, so a scanner that presses it verifies nothing.
 * `token` is `null` when the link has none, or one that can't be a token. The token leaves the
 * address bar and the history as soon as the page loads; the component keeps the one it was given.
 *
 * A link resent after a second sign-up answers `needs-password` (#289): the person chooses the
 * account's password here, and the same request then verifies the email.
 *
 * `status` is where the link stood when the page opened, read without changing anything (#391):
 * a link that already verified its account, or one that isn't valid, shows its message and the
 * Log In button, and no Confirm button.
 */
export function VerifyAccount({
  token: linkToken,
  status,
}: {
  token: string | null
  status: VerificationLinkStatus
}) {
  const [token] = useState(linkToken)
  const [answer, setAnswer] = useState<Answer | null>(() => {
    if (!token || status === 'invalid') return 'invalid-link'
    return status === 'already-verified' ? 'already-verified' : null
  })
  const [sending, setSending] = useState(false)
  // Once a password is asked for, the form stays until the account is verified
  const [choosingPassword, setChoosingPassword] = useState(false)
  // Counts answers to clicks, so focus moves to the message after each one (not on page load)
  const [answers, setAnswers] = useState(0)
  const messageRef = useRef<HTMLDivElement>(null)
  // Why the button can't send yet (the robot check is still running or couldn't load)
  const [waitMessage, setWaitMessage] = useState<string | null>(null)
  const robotCheck = useRobotCheck()

  useEffect(() => {
    // The check finished after a press that had to wait: the reason no longer holds
    if (robotCheck.token) setWaitMessage(null)
  }, [robotCheck.token])
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
  }, [])
  useEffect(() => {
    if (answers > 0) messageRef.current?.focus()
  }, [answers])

  const verify = async (password?: NewPasswordValues) => {
    if (!token || sending) return
    const pending = robotCheck.pendingMessage()
    setWaitMessage(pending)
    if (pending) return
    setSending(true)
    let next: Answer
    try {
      // Turnstile tokens are single use: each press sends one, then asks for a fresh one
      const result = await verifyAccount({ token, ...password }, robotCheck.token)
      next = result.ok ? 'verified' : result.failure
    } catch {
      next = 'offline'
    }
    robotCheck.renewToken()
    if (next === 'needs-password') setChoosingPassword(true)
    setAnswer(next)
    setSending(false)
    setAnswers((n) => n + 1)
  }

  // A verified account or a dead link: the next step is to log in
  const done = answer === 'verified' || answer === 'already-verified' || answer === 'invalid-link'

  return (
    <div className="space-y-6">
      {answer && (
        <div ref={messageRef} tabIndex={-1} className="outline-none">
          {answer === 'verified' ? (
            <Alert tone="success">{ACCOUNT_VERIFIED}</Alert>
          ) : answer === 'already-verified' ? (
            <Alert tone="success">{ACCOUNT_ALREADY_VERIFIED}</Alert>
          ) : answer === 'needs-password' ? (
            <p className="text-foreground">{CHOOSE_PASSWORD_TO_VERIFY}</p>
          ) : (
            <Alert tone="error">{toVerifyAccountErrorMessage(answer)}</Alert>
          )}
        </div>
      )}
      {!done && waitMessage && <Alert tone="error">{waitMessage}</Alert>}
      {!done && robotCheck.enabled && <TurnstileWidget {...robotCheck.widgetProps} />}
      {done ? (
        <Button href={SIGN_IN_PATH} fullWidth>
          Log In
        </Button>
      ) : choosingPassword ? (
        <Form<NewPasswordValues, NewPasswordValues>
          aria-label="Choose your password"
          schema={newPasswordSchema}
          defaultValues={{}}
          onSubmit={verify}
          status={sending ? 'submitting' : 'idle'}
        >
          {({ register, formState: { errors } }) => (
            <>
              <NewPasswordFields label="Password" register={register} errors={errors} />
              <div>
                <Button type="submit" loading={sending} fullWidth>
                  {sending ? 'Confirming' : 'Set Password and Confirm'}
                </Button>
              </div>
            </>
          )}
        </Form>
      ) : (
        <Button
          type="button"
          onClick={() => verify()}
          loading={sending}
          iconStart={<MailCheck aria-hidden />}
          fullWidth
        >
          {sending ? 'Confirming' : 'Confirm My Account'}
        </Button>
      )}
    </div>
  )
}
