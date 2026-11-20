import 'server-only'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { OutgoingEmail } from '@/platform/lib'

/**
 * Sends a note to an account's own address through Payload's email adapter (the same sender as
 * its verification and reset emails). Throws when sending fails: the caller decides that a
 * failed note is logged and never undoes what the note is about.
 */
export async function sendEmailToAccount(to: string, email: OutgoingEmail): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  await payload.sendEmail({ to, subject: email.subject, text: email.text, html: email.html })
}
