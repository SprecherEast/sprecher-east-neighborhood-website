import { isSingleAddress } from '@/platform/lib'

/**
 * Which form emails may go out, now that the site sends real email (decision 0004).
 *
 * 1. No mail to addresses the visitor typed in: a form email whose recipients come from the
 *    submission (e.g. a confirmation to "{{email}}") would let anyone make the site send mail
 *    to arbitrary addresses, including comma-separated lists. Those emails are dropped; emails
 *    to recipients the admin configured (e.g. info@) still go out. Re-enabling visitor
 *    confirmations is an owner decision (needs spam protection, see #112).
 * 2. A From filled from the submission is replaced by the SMTP default sender.
 * 3. A Reply-To filled from the submission (e.g. "{{email}}" on the owner notification) is kept
 *    only if it is exactly one plain address; otherwise it falls back to the From address, so a
 *    list or junk (or a CR/LF header injection) can't send the owner's reply elsewhere. The
 *    visitor's input stays in the body.
 */

/** One of a form's email settings as the admin wrote it; any field may hold "{{field}}". */
export type FormEmailSetting = {
  emailTo?: string | null
  cc?: string | null
  bcc?: string | null
  emailFrom?: string | null
  replyTo?: string | null
}

/** The headers of a formatted form email that these rules read or change. */
type EmailHeaders = { from: string; replyTo?: string }

/** Whether an email may go out; if so, the email to send and which headers were replaced. */
export type FormEmailDecision<E> =
  { send: false } | { send: true; email: E; fromReplaced: boolean; replyToReplaced: boolean }

/** True when a setting pulls in something the visitor submitted ("{{email}}"). */
export const hasSubmittedValue = (setting: string | null | undefined): boolean =>
  typeof setting === 'string' && setting.includes('{{')

/**
 * Decides whether one formatted email may be sent, and with which From and Reply-To. Decided
 * from the form's own setting for that email (`undefined` when there is none, which drops it),
 * so an admin-configured recipient is never dropped because of what a visitor typed.
 */
export function toSafeFormEmail<E extends EmailHeaders>(
  email: E,
  setting: FormEmailSetting | undefined,
): FormEmailDecision<E> {
  if (
    !setting ||
    hasSubmittedValue(setting.emailTo) ||
    hasSubmittedValue(setting.cc) ||
    hasSubmittedValue(setting.bcc)
  ) {
    return { send: false }
  }
  // A From built from submitted data would let a visitor pick the sender (and Mailgun/DMARC
  // would reject it): an empty From makes the email adapter use the SMTP default instead.
  const fromReplaced = hasSubmittedValue(setting.emailFrom)
  const from = fromReplaced ? '' : email.from
  // With no Reply-To setting, the plugin copies the From setting into Reply-To
  const replyToSubmitted = hasSubmittedValue(setting.replyTo) || (!setting.replyTo && fromReplaced)
  const replyTo = typeof email.replyTo === 'string' ? email.replyTo.trim() : email.replyTo
  if (replyToSubmitted && !(replyTo && isSingleAddress(replyTo))) {
    // The plugin's own default when no Reply-To is configured: the From address
    return {
      send: true,
      email: { ...email, from, replyTo: from },
      fromReplaced,
      replyToReplaced: true,
    }
  }
  return {
    send: true,
    email: fromReplaced ? { ...email, from } : email,
    fromReplaced,
    replyToReplaced: false,
  }
}
