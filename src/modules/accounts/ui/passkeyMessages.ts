import { message } from '@/platform/lib'
import { FORM_MESSAGES } from '@/platform/ui'

import type { AddPasskeyFailure } from '../domain/addPasskey'
import { GUARD_MESSAGES } from './guardMessages'

/** How the add-a-passkey card ended, for the message under its button. */
export type AddPasskeyOutcome =
  | AddPasskeyFailure
  | 'added'
  | 'cancelled'
  | 'already-here'
  | 'offline'

/** What the card shows: the message, its tone, and whether it offers to log in again. */
export type PasskeyNotice = {
  tone: 'success' | 'info' | 'warning' | 'error'
  text: string
  logInAgain: boolean
}

const notice = (tone: PasskeyNotice['tone'], text: string, logInAgain = false): PasskeyNotice => ({
  tone,
  text,
  logInAgain,
})

/**
 * The fixed message for each way adding a passkey can end, never the server's or the browser's
 * own text: both can carry details a neighbor shouldn't read. A cancelled prompt isn't an error.
 */
export function toAddPasskeyNotice(outcome: AddPasskeyOutcome): PasskeyNotice {
  switch (outcome) {
    case 'added':
      return notice('success', message('accounts.passkey.added'))
    case 'cancelled':
      return notice('info', message('accounts.passkey.cancelled'))
    case 'sign-in-again':
      return notice('warning', message('accounts.passkey.signInAgain'), true)
    case 'cap':
      return notice('warning', message('accounts.passkey.cap'))
    case 'already-here':
      return notice('info', message('accounts.passkey.alreadyHere'))
    case 'too-many':
      return notice('error', GUARD_MESSAGES['too-many'])
    case 'offline':
      return notice('error', FORM_MESSAGES.offline)
    case 'failed':
      return notice('error', message('accounts.passkey.failed'))
  }
}
