'use client'

import { MailCheck } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { Alert } from '@/platform/ui/Alert'
import { ConfirmedEmailContext } from '@/platform/ui/ConfirmedEmail.client'
import { Button, Link } from '@/platform/ui'
import { TurnstileWidget } from '@/platform/turnstile/TurnstileWidget.client'
import { useRobotCheck } from '@/platform/turnstile/useRobotCheck.client'

import type { LinkStatus } from '../domain/types'
import { postConfirmation, type ConfirmAnswer } from './api'
import { isLinkDone, isSettled, toConfirmMessage } from './confirmMessages'

type Answer = ConfirmAnswer | 'offline'

/**
 * The confirm page's action: one button that confirms the email the link was sent to. Nothing
 * happens on page load, because mail scanners open links too, and some run the page's script
 * (#303). The button also needs the robot check (Turnstile, decision 0003) to pass, so a scanner
 * that presses it confirms nothing. `token` is `null` when the link
 * has none, or one that can't be ours. `status` is where the link stood when the page opened,
 * read without changing anything (#391): a link already confirmed, expired or not valid shows its
 * message and no button. `retryHref` is where a person with a dead link can ask for a new one
 * (the contact form). `children` shows once the email is confirmed by this page's button (the
 * account offer, #187), and can read the confirmed address with `useConfirmedEmail`.
 */
export function ConfirmEmail({
  token,
  status,
  retryHref,
  children,
}: {
  token: string | null
  status: LinkStatus
  retryHref: string
  children?: React.ReactNode
}) {
  const [answer, setAnswer] = useState<Answer | null>(() => {
    if (!token) return 'invalid'
    return status === 'pending' ? null : status
  })
  const [email, setEmail] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  // Counts answers to clicks, so focus moves to the message after each one (not on page load)
  const [answers, setAnswers] = useState(0)
  const messageRef = useRef<HTMLDivElement>(null)
  // Why the button can't send yet (the robot check is still running or couldn't load)
  const [waitMessage, setWaitMessage] = useState<string | null>(null)
  const robotCheck = useRobotCheck()
  // An answer that comes back after the person left the page changes nothing
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Whether the link was already done with when the page opened (it never changes: later answers
  // clear the address themselves)
  const [openedDone] = useState(() => isLinkDone(answer))

  useEffect(() => {
    // A link already done with when the page opened: keep its token out of the address bar
    if (openedDone && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [openedDone])

  useEffect(() => {
    // The check finished after a press that had to wait: the reason no longer holds
    if (robotCheck.token) setWaitMessage(null)
  }, [robotCheck.token])

  useEffect(() => {
    // The button that had focus is gone or reset: put keyboard and screen reader users on the
    // answer instead of the top of the page
    if (answers > 0) messageRef.current?.focus()
  }, [answers])

  const confirm = async () => {
    if (!token || sending) return
    const pending = robotCheck.pendingMessage()
    setWaitMessage(pending)
    if (pending) return
    setSending(true)
    let next: Answer
    try {
      // Turnstile tokens are single use: each press sends one, then asks for a fresh one
      const reply = await postConfirmation(token, robotCheck.token)
      next = reply.answer
      setEmail(reply.email)
    } catch {
      next = 'offline'
    }
    if (!mounted.current) return
    robotCheck.renewToken()
    // The link is done with: keep its token out of the address bar and the history
    if (isLinkDone(next)) window.history.replaceState(null, '', window.location.pathname)
    setAnswer(next)
    setSending(false)
    setAnswers((n) => n + 1)
  }

  const message = answer ? toConfirmMessage(answer) : null
  const settled = isSettled(answer)
  const canConfirm = token !== null && !isLinkDone(answer)

  return (
    <div className="space-y-6">
      {message && (
        <div ref={messageRef} tabIndex={-1} className="space-y-3 outline-none">
          <Alert tone={message.tone}>{message.text}</Alert>
          {isLinkDone(answer) && !settled && (
            <Link href={retryHref} variant="action">
              Go to the contact form
            </Link>
          )}
        </div>
      )}
      {canConfirm && waitMessage && <Alert tone="error">{waitMessage}</Alert>}
      {canConfirm && robotCheck.enabled && <TurnstileWidget {...robotCheck.widgetProps} />}
      {canConfirm && (
        <Button
          type="button"
          onClick={confirm}
          loading={sending}
          iconStart={<MailCheck aria-hidden />}
          fullWidth="mobile"
        >
          {sending ? 'Confirming' : 'Confirm my email'}
        </Button>
      )}
      {/* What comes next follows a confirmation made here, not a link opened again (#391) */}
      {settled && answers > 0 && (
        <ConfirmedEmailContext value={email}>{children}</ConfirmedEmailContext>
      )}
    </div>
  )
}
