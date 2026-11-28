import { message } from '@/platform/lib'
import { FORM_MESSAGES } from '@/platform/ui'

import type { AddPasskeyFailure } from '../domain/addPasskey'
import type { RemovePasskeyFailure } from '../domain/removePasskey'
import type { PasskeySignInFailure } from '../domain/signInWithPasskey'
import { GUARD_MESSAGES } from './guardMessages'

/** How the add-a-passkey card ended, for the message under its button. */
export type AddPasskeyOutcome =
  AddPasskeyFailure | 'added' | 'cancelled' | 'already-here' | 'offline'

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
      return notice('success', message('accounts.passkey.added', { button: PASSKEY_LOGIN_LABEL }))
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

/** How removing a passkey ended, for the message above the list. */
export type RemovePasskeyOutcome = RemovePasskeyFailure | 'removed' | 'offline'

/**
 * The fixed message for each way removing a passkey can end, never the server's own text. An old
 * sign-in is asked to log in again, like adding one.
 */
export function toRemovePasskeyNotice(outcome: RemovePasskeyOutcome): PasskeyNotice {
  switch (outcome) {
    case 'removed':
      return notice('success', message('accounts.passkey.removed'))
    case 'sign-in-again':
      return notice('warning', message('accounts.passkey.removeSignInAgain'), true)
    case 'offline':
      return notice('error', FORM_MESSAGES.offline)
    case 'failed':
      return notice('error', message('accounts.passkey.removeFailed'))
  }
}

/** The label on the button that logs in with a passkey: the verb is the log in page's own. */
export const PASSKEY_LOGIN_LABEL = message('accounts.passkey.loginButton')

/** How logging in with a passkey ended, when it didn't open the account. */
export type PasskeyLoginOutcome = PasskeySignInFailure | 'cancelled' | 'offline'

/**
 * The fixed message for each way logging in with a passkey can fail, never the server's or the
 * browser's own text: both can carry details a neighbor shouldn't read, and none may say whether an
 * account exists. A prompt that ended with no passkey is not an error, and the browser says the
 * same whether none was saved or the box was closed, so after the button was pressed (`pressed`) it
 * gets one plain note with the way forward, claiming neither (#1364); one nobody asked for (the
 * email field's autofill) gets no message (null), and the page stays as it was.
 */
export function toPasskeyLoginNotice(
  outcome: PasskeyLoginOutcome,
  { pressed = false }: { pressed?: boolean } = {},
): Pick<PasskeyNotice, 'tone' | 'text'> | null {
  if (outcome === 'cancelled') {
    return pressed ? { tone: 'info', text: message('accounts.passkey.noneFound') } : null
  }
  if (outcome === 'too-many') return { tone: 'error', text: GUARD_MESSAGES['too-many'] }
  if (outcome === 'offline') return { tone: 'error', text: FORM_MESSAGES.offline }
  // `failed`, and any code this build doesn't know: one fixed message, never the server's text
  return { tone: 'error', text: message('accounts.passkey.loginFailed') }
}
