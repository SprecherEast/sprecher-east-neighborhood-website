import { FORM_MESSAGES } from '@/platform/ui'

import type { ConfirmAnswer } from './api'

/** How a message is shown: a success (status) or a problem (alert). */
export type ConfirmMessage = { tone: 'success' | 'error'; text: string }

const MESSAGES: Record<ConfirmAnswer | 'offline', ConfirmMessage> = {
  confirmed: {
    tone: 'success',
    text: 'Thanks, your email is confirmed. A welcome email is on its way.',
  },
  'already-confirmed': {
    tone: 'success',
    text: 'This email is already confirmed. There’s nothing more to do.',
  },
  // A message waits for its sender's click; unconfirmed, it is deleted after 48 hours (#274), so
  // these say what happened to it and how to get through
  expired: {
    tone: 'error',
    text: 'This link has expired, so your message hasn’t been passed on. Links work for 24 hours: send the form again to get a new one.',
  },
  invalid: {
    tone: 'error',
    text: 'This link isn’t valid, or it’s more than 2 days old. Check that you opened the whole link from the email, or send the form again to get a new one.',
  },
  'robot-check': {
    tone: 'error',
    text: 'The spam check didn’t pass. Please wait a moment and press Confirm again.',
  },
  'too-many-tries': {
    tone: 'error',
    text: 'Too many tries from your connection. Please wait a few minutes and try again.',
  },
  failed: { tone: 'error', text: FORM_MESSAGES.failed },
  offline: { tone: 'error', text: FORM_MESSAGES.offline },
}

/** The fixed message for what happened, so the person knows where they stand. */
export const toConfirmMessage = (answer: ConfirmAnswer | 'offline'): ConfirmMessage =>
  MESSAGES[answer]

/** Whether the email is confirmed, now or before. */
export const isSettled = (answer: ConfirmAnswer | 'offline' | null): boolean =>
  answer === 'confirmed' || answer === 'already-confirmed'

/**
 * Whether the link can do nothing more: confirmed, expired or not valid. No button then. Too many
 * tries, a server error or no answer can still be tried again.
 */
export const isLinkDone = (answer: ConfirmAnswer | 'offline' | null): boolean =>
  isSettled(answer) || answer === 'expired' || answer === 'invalid'
