import { type OutgoingEmail, toEmailHtml } from '@/platform/lib'

import { toEmailWhen } from './emailWhen'

/**
 * The note sent to an account's own address when a passkey is added (#1314, decision 0021). It is
 * the control for someone who got in with a stolen password and added their own passkey, so it
 * names the label and the time and says what to do. It holds no link at all: a link in an email
 * is the thing a phisher copies, and the person knows the way to the site. The label is the
 * resident's own text, cut to letters, numbers and a few marks by `toPasskeyLabel` so it can't carry
 * a clickable link or address; the subject is fixed.
 */
export function toPasskeyAddedEmail({ label, at }: { label: string; at: Date }): OutgoingEmail {
  const when = toEmailWhen(at)
  // The name sits on its own line, apart from what to do, so it can't read as part of the advice
  const intro = `A passkey was added to your Sprecher East account on ${when}.`
  const named = `Its name: “${label}”. If that was you, there’s nothing more to do.`
  const outro =
    'If it wasn’t you, choose “Forgot your password?” on the log in page to set a new password. Then remove the passkey on your account page.'
  return {
    subject: 'A passkey was added to your account',
    text: `${intro}\n\n${named}\n\n${outro}\n`,
    html: toEmailHtml([intro, named, outro]),
  }
}

/**
 * The note sent to an account's own address when a passkey is removed (#1316, decision 0021), by
 * the neighbor on their account page or by an admin in `/admin`: one note for both. It is the
 * control for someone who got into a session and removed the passkey that would let the owner
 * back in, so it names the label and the time and says what to do. It holds no link at all, and
 * the label is cut to letters, numbers and a few marks (`toPasskeyLabel`); the subject is fixed.
 */
export function toPasskeyRemovedEmail({ label, at }: { label: string; at: Date }): OutgoingEmail {
  const when = toEmailWhen(at)
  const intro = `A passkey was removed from your Sprecher East account on ${when}.`
  const named = `Its name: “${label}”. If you removed it, or asked us to, there’s nothing more to do.`
  const outro =
    'If it wasn’t you, choose “Forgot your password?” on the log in page to set a new password, then tell us through the contact form.'
  return {
    subject: 'A passkey was removed from your account',
    text: `${intro}\n\n${named}\n\n${outro}\n`,
    html: toEmailHtml([intro, named, outro]),
  }
}
