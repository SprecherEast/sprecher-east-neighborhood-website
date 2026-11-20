import { SITE_TIMEZONE } from '@/platform/lib/timezone'

/** A moment as the account notes write it, in the site's time zone: "Nov 19, 2026, 5:05 PM CST". */
export function toEmailWhen(at: Date): string {
  return at.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: SITE_TIMEZONE,
    timeZoneName: 'short',
  })
}
