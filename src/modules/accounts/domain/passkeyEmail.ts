import { type OutgoingEmail, toEmailHtml } from '@/platform/lib'
import { SITE_TIMEZONE } from '@/platform/lib/timezone'

/**
 * The note sent to an account's own address when a passkey is added (#1314, decision 0021). It is
 * the control for someone who got in with a stolen password and added their own passkey, so it
 * names the label and the time and says what to do. It holds no link at all: a link in an email
 * is the thing a phisher copies, and the person knows the way to the site. The label is the
 * resident's own text, one line, already cut to length (`toPasskeyLabel`); the subject is fixed.
 */
export function toPasskeyAddedEmail({ label, at }: { label: string; at: Date }): OutgoingEmail {
  const when = at.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: SITE_TIMEZONE,
    timeZoneName: 'short',
  })
  const intro = `A passkey called “${label}” was added to your Sprecher East account on ${when}. If that was you, there’s nothing more to do.`
  const outro =
    'If it wasn’t you, choose “Forgot your password?” on the log in page to set a new password. Then remove the passkey on your account page.'
  return {
    subject: 'A passkey was added to your account',
    text: `${intro}\n\n${outro}\n`,
    html: toEmailHtml([intro, outro]),
  }
}
