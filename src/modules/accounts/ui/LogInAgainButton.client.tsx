'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

import { Button } from '@/platform/ui'

import { signOut } from '../actions'
import { SIGN_IN_PATH } from '../domain/paths'

/**
 * "Log in again" for a step that needs a recent sign-in (adding a passkey, connecting Google): it
 * ends this session and opens the log in page, and signing in lands back on the account page. One
 * piece for every card that asks for it. `onFailed` runs when signing out gets no answer, so the
 * card can say so.
 */
export function LogInAgainButton({ onFailed }: { onFailed?: () => void }) {
  const router = useRouter()
  const logInAgain = async () => {
    try {
      await signOut()
    } catch {
      return onFailed?.()
    }
    router.push(SIGN_IN_PATH)
    router.refresh()
  }
  return (
    <div>
      <Button variant="secondary" fullWidth="mobile" onClick={logInAgain}>
        Log in again
      </Button>
    </div>
  )
}
