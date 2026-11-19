'use client'

import { UserPlus } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { useConfirmedEmail } from '@/platform/ui/ConfirmedEmail.client'
import { Button, Link } from '@/platform/ui'
import { Card } from '@/platform/ui/Card'

import { SIGN_UP_PATH } from '../domain/paths'
import { toSignUpHref } from '../domain/signUpLink'

/**
 * The account offer after a contact sender confirms their email (#187): an account is offered,
 * not imposed. "Yes" only opens the sign-up page with the confirmed email filled in; nothing is
 * created until that form is sent. "No" creates nothing and sends nothing.
 */
export function AccountOffer() {
  const email = useConfirmedEmail()
  const [declined, setDeclined] = useState(false)
  const answerRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    // The "No" button is gone: put keyboard and screen reader users on the answer
    if (declined) answerRef.current?.focus()
  }, [declined])

  if (declined) {
    return (
      <p ref={answerRef} tabIndex={-1} className="text-muted-foreground outline-none">
        No problem: no account was made. You can create one later on the{' '}
        <Link href={SIGN_UP_PATH} variant="inline">
          sign-up page
        </Link>
        .
      </p>
    )
  }

  return (
    <Card
      as="section"
      variant="outline"
      aria-labelledby="account-offer-title"
      className="space-y-4"
    >
      <h2 id="account-offer-title" className="text-xl font-bold text-foreground">
        Create a free Sprecher East account?
      </h2>
      <p className="text-muted-foreground">
        It’s optional. You’ll choose a password, and we’ll send one more email to confirm the
        account.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button href={toSignUpHref(email)} iconStart={<UserPlus aria-hidden />} fullWidth="mobile">
          Yes, Create an Account
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setDeclined(true)}
          fullWidth="mobile"
        >
          No, Thanks
        </Button>
      </div>
    </Card>
  )
}
