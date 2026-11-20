import { type OutgoingEmail, toEmailHtml } from '@/platform/lib'
import { SITE_TIMEZONE } from '@/platform/lib/timezone'

/**
 * The note sent to an account's own address when Google is connected to it (#1338, decision
 * 0020). It is the control for someone who got in with a stolen password and connected their own
 * Google, so it names the time and says what to do. It holds no link at all: a link in an email is
 * the thing a phisher copies, and the person knows the way to the site. Nothing from Google goes
 * in it, so there is nothing to escape; the subject is fixed.
 */
export function toGoogleConnectedEmail({ at }: { at: Date }): OutgoingEmail {
  const when = at.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: SITE_TIMEZONE,
    timeZoneName: 'short',
  })
  const intro = `Google was connected to your Sprecher East account on ${when}.`
  const same = 'If that was you, there’s nothing more to do.'
  const outro =
    'If it wasn’t you, choose “Forgot your password?” on the log in page to change your password, then tell us through the contact form.'
  return {
    subject: 'Google was connected to your account',
    text: `${intro}\n\n${same}\n\n${outro}\n`,
    html: toEmailHtml([intro, same, outro]),
  }
}
