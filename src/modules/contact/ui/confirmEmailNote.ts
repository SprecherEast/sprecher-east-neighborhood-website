import { CONFIRMATION_LINK_LIFETIME_MS, formatDuration, message } from '@/platform/lib'

/**
 * Shown after the form's own thank-you when the form asks for an email (#274): a message reaches
 * the neighborhood team only once its sender clicks the confirmation link. Every sender sees it,
 * so it never says whether the address they typed is confirmed.
 */
export const CONFIRM_EMAIL_NOTE = message('contact.sent.checkEmail', {
  linkLifetime: formatDuration(CONFIRMATION_LINK_LIFETIME_MS),
})
